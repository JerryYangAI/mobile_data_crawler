import { readFileSync } from 'fs';
import { frameHash, hammingDistance } from './FrameHash.js';
import { normalizeRecord, resolveChannel, PACKAGE_CHANNEL_MAP, UNRECOGNIZED } from './schema.js';

/**
 * L1.5 自动轮询采集引擎（生产者-消费者结构）：
 *
 *   截图哨兵(每~2s) → 帧稳定判定(本地dHash,毫秒级) → 候选队列 → 提取工人(串行调模型)
 *
 * 设计要点：
 * - 截图抢"时机"、提取抢"算力"，两者用队列解耦，翻页快于提取不丢数据
 * - 画面"变化后又稳定、且不同于上一个候选"才触发，同页停留只采一次
 * - 前台不在目标App/微信时哨兵暂停（隐私防线一）
 * - 非商品页的截图立即删除（隐私防线二）
 * - shadow 影子模式：全链路照跑但不入库，用于验证捕获率
 * - auto 模式：自动入库并标记 review_status=pending，等人工批量复核
 */

// 阈值按 306 位指纹标定（FrameHash.HASH_BITS）
// 帧稳定阈值：与上一帧距离 <= 此值视为画面已停稳
const STABLE_THRESHOLD = 12;
// 完全相同阈值：变化后停稳的画面与上一候选距离 <= 此值才视为"还是同一画面"跳过。
// 注意：不能用大阈值判"新页面"——同模板小程序两个商品页的指纹距离可能很小，
// 会导致漏采（实测教训）。宁可多采靠指纹去重兜底，不可漏采。
const DUP_SKIP_THRESHOLD = 8;
// 提取并发数：与提取耗时匹配，防止队列积压
const EXTRACT_CONCURRENCY = 3;

class AutoCollector {
  constructor({ deviceManager, extractionAgent, store, model, logger }) {
    this.deviceManager = deviceManager;
    this.extractionAgent = extractionAgent;
    this.store = store;
    this.model = model;
    this.logger = logger;
    this.onEvent = null; // server.js 注入，推给前端 socket
    this.session = null;
  }

  emit(event) {
    if (this.onEvent) {
      try {
        this.onEvent({ ...event, at: new Date().toISOString() });
      } catch { /* 推送失败不影响采集 */ }
    }
  }

  isRunning() {
    return !!(this.session && this.session.running);
  }

  start({ deviceSerial, mode = 'shadow', batchName, intervalMs = 1500, onlyAllowedApps = true }) {
    if (this.isRunning()) {
      throw new Error('自动采集已在运行中，请先停止');
    }
    if (!deviceSerial) {
      throw new Error('缺少 deviceSerial');
    }

    this.session = {
      deviceSerial,
      mode, // 'shadow' | 'auto'
      batchName: batchName || new Date().toISOString().slice(0, 10),
      intervalMs: Math.max(1000, intervalMs || 1500),
      onlyAllowedApps,
      running: true,
      startedAt: new Date().toISOString(),
      prevHash: null,
      lastCandidateHash: null,
      sawTransition: false,
      queue: [],
      activeWorkers: 0,
      stats: {
        ticks: 0,
        pausedTicks: 0,
        candidates: 0,
        extracted: 0,
        products: 0,
        nonProduct: 0,
        saved: 0,
        errors: 0
      },
      log: [] // 会话事件日志（供影子模式对账）
    };

    this.logger.info(`[自动采集] 启动 mode=${mode}`, { deviceSerial, batchName: this.session.batchName });
    this.emit({ type: 'session_started', mode, batchName: this.session.batchName });
    this.runLoop();
    return this.status();
  }

  stop() {
    if (!this.session) return null;
    this.session.running = false;
    this.logger.info('[自动采集] 停止（队列中剩余任务将继续提取完）', {
      queueDepth: this.session.queue.length
    });
    this.emit({ type: 'session_stopped', stats: this.session.stats, queueDepth: this.session.queue.length });
    return this.status();
  }

  status() {
    if (!this.session) {
      return { running: false };
    }
    const s = this.session;
    return {
      running: s.running,
      mode: s.mode,
      deviceSerial: s.deviceSerial,
      batchName: s.batchName,
      startedAt: s.startedAt,
      stats: { ...s.stats, queueDepth: s.queue.length + s.activeWorkers },
      log: s.log.slice(-500)
    };
  }

  pushLog(entry) {
    this.session.log.push({ ...entry, at: new Date().toISOString() });
    if (this.session.log.length > 500) this.session.log.shift();
  }

  async runLoop() {
    const session = this.session;
    while (session.running) {
      const tickStart = Date.now();
      try {
        await this.tick(session);
      } catch (error) {
        session.stats.errors++;
        this.logger.error('[自动采集] tick 异常', error);
        this.emit({ type: 'error', message: error.message });
      }
      const elapsed = Date.now() - tickStart;
      const waitMs = Math.max(200, session.intervalMs - elapsed);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }

  async tick(session) {
    session.stats.ticks++;

    // 隐私防线一：前台不在目标 App 内则暂停拍摄
    if (session.onlyAllowedApps) {
      const foreground = await this.deviceManager.getForegroundActivity(session.deviceSerial);
      const pkg = foreground ? foreground.split('/')[0] : null;
      if (!pkg || !PACKAGE_CHANNEL_MAP[pkg]) {
        session.stats.pausedTicks++;
        session.prevHash = null; // 回到目标App后重新建立基线
        this.emit({ type: 'paused_foreground', package: pkg || 'unknown' });
        return;
      }
      session.currentPackage = pkg;
    }

    const base64 = await this.deviceManager.getScreenshotBase64(session.deviceSerial);
    if (!base64) {
      session.stats.errors++;
      this.emit({ type: 'error', message: '截图失败' });
      return;
    }

    const hash = frameHash(Buffer.from(base64, 'base64'));

    // 画面还在变化（滑动/翻页/加载中）：记下"发生过转场"，等它停稳
    if (session.prevHash && hammingDistance(session.prevHash, hash) > STABLE_THRESHOLD) {
      session.prevHash = hash;
      session.sawTransition = true;
      return;
    }
    const isFirstFrame = !session.prevHash;
    session.prevHash = hash;
    if (isFirstFrame) {
      session.sawTransition = true; // 启动时已停在某页上，也算一次待采候选
      return;
    }

    // 触发条件是"转场后首次停稳"，而不是"和上一候选足够不同"——
    // 同模板小程序两个商品页指纹可能很接近，按差异判会漏采。
    if (!session.sawTransition) return; // 同页持续停留，不重复触发

    // 转场后停稳，但画面和上一候选几乎一模一样（如弹窗开了又关）→ 跳过
    if (session.lastCandidateHash &&
        hammingDistance(session.lastCandidateHash, hash) <= DUP_SKIP_THRESHOLD) {
      session.sawTransition = false;
      return;
    }

    // 新的稳定画面 → 候选！
    session.sawTransition = false;
    session.lastCandidateHash = hash;
    session.stats.candidates++;
    const captureId = `cap_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    this.store.saveScreenshot(captureId, base64);
    session.queue.push({ captureId, foregroundPackage: session.currentPackage || null });
    this.pushLog({ kind: 'captured', captureId });
    this.emit({ type: 'captured', captureId, queueDepth: session.queue.length });
    this.processQueue(session);
  }

  /**
   * 提取工人池：最多 EXTRACT_CONCURRENCY 路并发消费队列
   * （单次提取可能耗时数分钟，串行会让逛店速度远超清队速度）
   * session 停止后继续把队列清空。
   */
  processQueue(session) {
    while (session.queue.length > 0 && session.activeWorkers < EXTRACT_CONCURRENCY) {
      const job = session.queue.shift();
      session.activeWorkers++;
      this.extractOne(session, job)
        .catch(error => {
          session.stats.errors++;
          this.logger.error(`[自动采集] 提取失败 ${job.captureId}`, error);
          this.pushLog({ kind: 'error', captureId: job.captureId, message: error.message });
          this.emit({ type: 'extract_error', captureId: job.captureId, message: error.message });
        })
        .finally(() => {
          session.activeWorkers--;
          if (session.queue.length > 0) {
            this.processQueue(session);
          } else if (!session.running && session.activeWorkers === 0) {
            this.emit({ type: 'queue_drained', stats: session.stats });
          }
        });
    }
  }

  async extractOne(session, job) {
    const screenshotPath = this.store.getScreenshotPath(job.captureId);
    if (!screenshotPath) {
      throw new Error('截图文件丢失');
    }
    const base64 = readFileSync(screenshotPath).toString('base64');

    const result = await this.extractionAgent.extract(base64, {
      foregroundPackage: job.foregroundPackage
    });
    session.stats.extracted++;

    if (result.notProductPage) {
      // 隐私防线二：非商品页截图立即删除
      this.store.deleteScreenshot(job.captureId);
      session.stats.nonProduct++;
      this.pushLog({ kind: 'non_product', captureId: job.captureId, reason: result.reason });
      this.emit({
        type: 'extracted_non_product',
        captureId: job.captureId,
        reason: result.reason,
        queueDepth: session.queue.length
      });
      return;
    }

    const draft = normalizeRecord({
      capture_id: job.captureId,
      captured_at: new Date().toISOString(),
      source_app: resolveChannel(job.foregroundPackage),
      source_package: job.foregroundPackage || UNRECOGNIZED,
      collection_batch: session.batchName,
      screenshot_file: `${job.captureId}.png`,
      device_serial: session.deviceSerial,
      extraction_model: this.model || UNRECOGNIZED,
      notes: '',
      review_status: session.mode === 'auto' ? 'pending' : 'shadow',
      ...result.fields
    });

    session.stats.products++;

    if (session.mode === 'auto') {
      const saved = this.store.appendRecord(draft);
      session.stats.saved++;
      this.pushLog({
        kind: 'saved',
        captureId: job.captureId,
        productName: saved.product_name,
        duplicateOf: saved.duplicate_of || null
      });
      this.emit({
        type: 'record_saved',
        record: saved,
        queueDepth: session.queue.length
      });
    } else {
      // 影子模式：不入库，只记会话日志供对账
      this.pushLog({
        kind: 'shadow_product',
        captureId: job.captureId,
        productName: draft.product_name,
        price: draft.price
      });
      this.emit({
        type: 'shadow_product',
        captureId: job.captureId,
        productName: draft.product_name,
        price: draft.price,
        queueDepth: session.queue.length
      });
    }
  }
}

export default AutoCollector;
