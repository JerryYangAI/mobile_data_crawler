import { Router } from 'express';
import { readFileSync } from 'fs';
import { normalizeRecord, resolveChannel, UNRECOGNIZED } from './schema.js';
import { buildXlsx } from './xlsxExporter.js';

/**
 * FSTea 采集模式 API。
 * 对手机只做两类只读操作：截图（screencap）、查前台应用（dumpsys），
 * 不经过 CommandExecutor，不存在执行 Tap/Swipe 的代码路径。
 */
export default function createCollectorRouter({ deviceManager, extractionAgent, store, model, logger, autoCollector }) {
  const router = Router();

  function generateCaptureId() {
    return `cap_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  function defaultBatch() {
    return new Date().toISOString().slice(0, 10); // 按日期分批
  }

  // 提取当前屏幕商品信息（截图落盘 + 模型提取，返回草稿，不入库）
  router.post('/extract', async (req, res) => {
    const { deviceSerial, batchName } = req.body || {};
    if (!deviceSerial) {
      return res.status(400).json({ success: false, error: '缺少 deviceSerial' });
    }

    try {
      const [screenshotBase64, foregroundActivity] = await Promise.all([
        deviceManager.getScreenshotBase64(deviceSerial),
        deviceManager.getForegroundActivity(deviceSerial)
      ]);

      if (!screenshotBase64) {
        return res.status(500).json({ success: false, error: '获取截图失败，请检查设备连接' });
      }

      const captureId = generateCaptureId();
      const screenshotFile = store.saveScreenshot(captureId, screenshotBase64);
      const foregroundPackage = foregroundActivity ? foregroundActivity.split('/')[0] : null;

      logger.info(`[采集] 开始提取 ${captureId}`, { deviceSerial, foregroundPackage });

      const result = await extractionAgent.extract(screenshotBase64, { foregroundPackage });

      if (result.notProductPage) {
        // 隐私防线：非商品页截图不保留
        store.deleteScreenshot(captureId);
        logger.warn(`[采集] 当前不是商品页: ${result.reason}`, { captureId });
        return res.json({
          success: true,
          notProductPage: true,
          reason: result.reason,
          captureId
        });
      }

      const draft = normalizeRecord({
        capture_id: captureId,
        captured_at: new Date().toISOString(),
        source_app: resolveChannel(foregroundPackage),
        source_package: foregroundPackage || UNRECOGNIZED,
        collection_batch: batchName || defaultBatch(),
        screenshot_file: screenshotFile,
        device_serial: deviceSerial,
        extraction_model: model || UNRECOGNIZED,
        notes: '',
        ...result.fields
      });

      const duplicateOf = store.findDuplicate(draft);
      logger.info(`[采集] 提取完成: ${draft.product_name}`, { captureId, duplicateOf });

      res.json({ success: true, record: draft, duplicateOf });
    } catch (error) {
      logger.error('[采集] 提取失败', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 确认保存一条记录（前端可先人工修正）
  router.post('/records', (req, res) => {
    const { record } = req.body || {};
    if (!record || !record.capture_id) {
      return res.status(400).json({ success: false, error: '缺少 record 或 capture_id' });
    }
    if (store.hasCaptureId(record.capture_id)) {
      return res.status(409).json({ success: false, error: '该采集记录已保存过' });
    }

    try {
      const saved = store.appendRecord(normalizeRecord(record));
      logger.info(`[采集] 已入库: ${saved.product_name}`, { captureId: saved.capture_id });
      res.json({ success: true, record: saved });
    } catch (error) {
      logger.error('[采集] 保存失败', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 已采集记录列表
  router.get('/records', (req, res) => {
    const { batch } = req.query;
    res.json({
      success: true,
      records: store.listRecords(batch || null),
      batches: store.listBatches(),
      pendingCount: store.pendingCount()
    });
  });

  // 从已保存的截图证据重新提取并入库（影子记录补录、prompt 升级后重跑历史证据）
  router.post('/records/from-screenshot', async (req, res) => {
    const { captureId, batchName, sourceApp, reviewStatus } = req.body || {};
    if (!captureId) {
      return res.status(400).json({ success: false, error: '缺少 captureId' });
    }
    if (store.hasCaptureId(captureId)) {
      return res.status(409).json({ success: false, error: '该采集记录已入库' });
    }
    const screenshotPath = store.getScreenshotPath(captureId);
    if (!screenshotPath) {
      return res.status(404).json({ success: false, error: '截图证据不存在' });
    }

    try {
      const base64 = readFileSync(screenshotPath).toString('base64');
      const result = await extractionAgent.extract(base64, {});

      if (result.notProductPage) {
        return res.json({ success: true, notProductPage: true, reason: result.reason, captureId });
      }

      const record = store.appendRecord(normalizeRecord({
        capture_id: captureId,
        captured_at: new Date().toISOString(),
        source_app: sourceApp || UNRECOGNIZED,
        source_package: UNRECOGNIZED,
        collection_batch: batchName || new Date().toISOString().slice(0, 10),
        screenshot_file: `${captureId}.png`,
        device_serial: UNRECOGNIZED,
        extraction_model: model || UNRECOGNIZED,
        notes: '影子模式补录',
        review_status: reviewStatus === 'approved' ? 'approved' : 'pending',
        ...result.fields
      }));

      logger.info(`[采集] 截图补录入库: ${record.product_name}`, { captureId });
      res.json({ success: true, record });
    } catch (error) {
      logger.error('[采集] 截图补录失败', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 复核一条记录：approve 通过 / update 修改并通过 / delete 删除
  router.post('/records/:captureId/review', (req, res) => {
    const { action, patch } = req.body || {};
    if (!['approve', 'update', 'delete'].includes(action)) {
      return res.status(400).json({ success: false, error: 'action 必须是 approve/update/delete' });
    }
    try {
      const record = store.appendReview(req.params.captureId, action, patch);
      logger.info(`[复核] ${action}: ${req.params.captureId}`);
      res.json({ success: true, record });
    } catch (error) {
      res.status(404).json({ success: false, error: error.message });
    }
  });

  // ==== L1.5 自动轮询模式 ====

  router.post('/auto/start', (req, res) => {
    const { deviceSerial, mode, batchName, intervalMs, onlyAllowedApps } = req.body || {};
    try {
      const status = autoCollector.start({
        deviceSerial,
        mode: mode === 'auto' ? 'auto' : 'shadow', // 默认影子模式，显式选择才真入库
        batchName,
        intervalMs,
        onlyAllowedApps: onlyAllowedApps !== false
      });
      res.json({ success: true, status });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/auto/stop', (req, res) => {
    const status = autoCollector.stop();
    res.json({ success: true, status });
  });

  router.get('/auto/status', (req, res) => {
    res.json({ success: true, status: autoCollector.status() });
  });

  // 导出 Excel（每行嵌入截图缩略图，供人工查看/汇报用）
  router.get('/export.xlsx', async (req, res) => {
    try {
      const { batch } = req.query;
      const buffer = await buildXlsx(store, batch || null, logger);
      const filename = `fstea_products_${batch || 'all'}_${Date.now()}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(Buffer.from(buffer));
    } catch (error) {
      logger.error('[采集] Excel 导出失败', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 导出 CSV（纯文本，供 FStea 数据管道导入；图片见 Excel 导出）
  router.get('/export.csv', (req, res) => {
    const { batch } = req.query;
    const csv = store.toCSV(batch || null);
    const filename = `fstea_products_${batch || 'all'}_${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  });

  // 回看截图证据
  router.get('/screenshots/:captureId', (req, res) => {
    const path = store.getScreenshotPath(req.params.captureId);
    if (!path) {
      return res.status(404).json({ success: false, error: '截图不存在' });
    }
    res.sendFile(path);
  });

  return router;
}
