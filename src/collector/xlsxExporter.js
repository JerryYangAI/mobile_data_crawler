import ExcelJS from 'exceljs';
import { PNG } from 'pngjs';
import { readFileSync } from 'fs';
import { ALL_FIELDS } from './schema.js';

/**
 * 导出含截图缩略图的 Excel。
 * CSV 是纯文本放不了图片；xlsx 支持在单元格锚点嵌入图片，
 * 每行嵌入该记录的截图缩略图（高度约160px，控制文件体积）。
 */

const THUMB_HEIGHT = 160; // px

function makeThumbnail(pngBuffer) {
  const src = PNG.sync.read(pngBuffer);
  const scale = THUMB_HEIGHT / src.height;
  const w = Math.max(1, Math.round(src.width * scale));
  const out = new PNG({ width: w, height: THUMB_HEIGHT });
  for (let y = 0; y < THUMB_HEIGHT; y++) {
    const sy = Math.min(src.height - 1, Math.floor(y / scale));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(src.width - 1, Math.floor(x / scale));
      const si = (sy * src.width + sx) << 2;
      const di = (y * w + x) << 2;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = 255;
    }
  }
  return { buffer: PNG.sync.write(out), width: w, height: THUMB_HEIGHT };
}

export async function buildXlsx(store, batch = null, logger = null) {
  const records = store.listRecords(batch);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('采集记录');

  sheet.columns = [
    { header: '截图', width: 12 },
    ...ALL_FIELDS.map(f => ({ header: f.label, key: f.key, width: f.key === 'claims' || f.key === 'ingredients' ? 30 : 16 }))
  ];
  sheet.getRow(1).font = { bold: true };

  const keys = ALL_FIELDS.map(f => f.key);
  let rowIdx = 2;
  for (const record of records) {
    const row = sheet.getRow(rowIdx);
    keys.forEach((key, i) => {
      row.getCell(i + 2).value = record[key] ?? '';
      row.getCell(i + 2).alignment = { vertical: 'top', wrapText: true };
    });

    const screenshotPath = store.getScreenshotPath(record.capture_id);
    if (screenshotPath) {
      try {
        const thumb = makeThumbnail(readFileSync(screenshotPath));
        const imageId = workbook.addImage({ buffer: thumb.buffer, extension: 'png' });
        sheet.addImage(imageId, {
          tl: { col: 0, row: rowIdx - 1 },
          ext: { width: thumb.width, height: thumb.height },
          editAs: 'oneCell'
        });
        row.height = THUMB_HEIGHT * 0.75; // 行高单位是 pt (1px ≈ 0.75pt)
      } catch (error) {
        if (logger) logger.warn(`缩略图生成失败 ${record.capture_id}: ${error.message}`);
      }
    }
    rowIdx++;
  }

  return workbook.xlsx.writeBuffer();
}
