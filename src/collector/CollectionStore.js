import { mkdirSync, existsSync, readFileSync, appendFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { ALL_FIELDS, fingerprint } from './schema.js';

/**
 * 采集数据持久化：
 * - data/collections/products.jsonl        记录事件流，追加写、永不覆盖
 * - data/collections/review_events.jsonl   复核事件流（通过/修改/删除），同样只追加
 * - data/collections/screenshots/          每条记录的截图证据
 * 记录常驻内存（Phase 1 量级足够），启动时按"记录 + 复核事件"重放恢复。
 */
class CollectionStore {
  constructor(dataDir, logger) {
    this.dataDir = dataDir;
    this.screenshotDir = join(dataDir, 'screenshots');
    this.jsonlPath = join(dataDir, 'products.jsonl');
    this.reviewPath = join(dataDir, 'review_events.jsonl');
    this.logger = logger;
    this.records = [];

    mkdirSync(this.screenshotDir, { recursive: true });
    this.loadRecords();
  }

  loadRecords() {
    if (existsSync(this.jsonlPath)) {
      for (const line of readFileSync(this.jsonlPath, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        try {
          this.records.push(JSON.parse(line));
        } catch (error) {
          this.logger.warn(`跳过无法解析的 JSONL 行: ${line.slice(0, 80)}`);
        }
      }
    }
    // 重放复核事件流
    if (existsSync(this.reviewPath)) {
      for (const line of readFileSync(this.reviewPath, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        try {
          this.applyReviewEvent(JSON.parse(line));
        } catch (error) {
          this.logger.warn(`跳过无法解析的复核事件: ${line.slice(0, 80)}`);
        }
      }
    }
    this.logger.info(`采集库已加载 ${this.records.length} 条历史记录`);
  }

  applyReviewEvent(event) {
    const record = this.records.find(r => r.capture_id === event.capture_id);
    if (!record) return;
    if (event.action === 'delete') {
      record._deleted = true;
    } else if (event.action === 'update') {
      Object.assign(record, event.patch || {});
      record.review_status = 'approved';
    } else if (event.action === 'approve') {
      record.review_status = 'approved';
    }
  }

  /**
   * 追加一条复核事件（通过 / 修改 / 删除），并应用到内存
   */
  appendReview(captureId, action, patch = null) {
    const record = this.records.find(r => r.capture_id === captureId);
    if (!record) {
      throw new Error(`记录不存在: ${captureId}`);
    }
    const event = {
      capture_id: captureId,
      action,
      patch: patch || undefined,
      reviewed_at: new Date().toISOString()
    };
    appendFileSync(this.reviewPath, JSON.stringify(event) + '\n', 'utf8');
    this.applyReviewEvent(event);
    return record;
  }

  saveScreenshot(captureId, base64) {
    const filename = `${captureId}.png`;
    writeFileSync(join(this.screenshotDir, filename), Buffer.from(base64, 'base64'));
    return filename;
  }

  getScreenshotPath(captureId) {
    // 严格校验 ID 格式，防止路径穿越
    if (!/^cap_[a-zA-Z0-9_]+$/.test(captureId)) return null;
    const path = join(this.screenshotDir, `${captureId}.png`);
    return existsSync(path) ? path : null;
  }

  /**
   * 删除截图（隐私防线：非商品页的截图不保留）
   */
  deleteScreenshot(captureId) {
    const path = this.getScreenshotPath(captureId);
    if (path) {
      try {
        unlinkSync(path);
      } catch (error) {
        this.logger.warn(`删除截图失败: ${captureId} ${error.message}`);
      }
    }
  }

  /**
   * 查找同指纹的已有记录（返回最早那条的 capture_id）
   */
  findDuplicate(record) {
    const fp = fingerprint(record);
    const existing = this.records.find(r => !r._deleted && fingerprint(r) === fp && !r.duplicate_of);
    return existing ? existing.capture_id : null;
  }

  hasCaptureId(captureId) {
    return this.records.some(r => r.capture_id === captureId);
  }

  /**
   * 追加一条记录。重复商品不丢弃，打 duplicate_of 标记后照常入库。
   */
  appendRecord(record) {
    const duplicateOf = this.findDuplicate(record);
    const finalRecord = {
      ...record,
      // 手动流程有人工确认过，默认视为已复核；自动流程显式传入 pending
      review_status: record.review_status || 'approved',
      duplicate_of: duplicateOf && duplicateOf !== record.capture_id ? duplicateOf : ''
    };
    appendFileSync(this.jsonlPath, JSON.stringify(finalRecord) + '\n', 'utf8');
    this.records.push(finalRecord);
    return finalRecord;
  }

  /**
   * 列出记录（新的在前），可按批次过滤，已删除的不返回
   */
  listRecords(batch = null) {
    const filtered = this.records.filter(r =>
      !r._deleted && (!batch || r.collection_batch === batch)
    );
    return [...filtered].reverse();
  }

  listBatches() {
    return [...new Set(this.records.filter(r => !r._deleted).map(r => r.collection_batch).filter(Boolean))];
  }

  pendingCount() {
    return this.records.filter(r => !r._deleted && r.review_status === 'pending').length;
  }

  /**
   * 导出 CSV（UTF-8 BOM，Excel 直接打开不乱码）
   */
  toCSV(batch = null) {
    const records = this.listRecords(batch);
    const keys = ALL_FIELDS.map(f => f.key);
    const header = ALL_FIELDS.map(f => f.label).join(',');
    const escape = (value) => {
      const str = String(value ?? '');
      return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const rows = records.map(r => keys.map(k => escape(r[k])).join(','));
    return '\uFEFF' + [header, ...rows].join('\n');
  }
}

export default CollectionStore;
