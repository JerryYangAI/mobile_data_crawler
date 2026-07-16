import { PNG } from 'pngjs';

/**
 * 截图帧的感知哈希：
 * 把画面降采样为 9x9 灰度网格，取四组特征拼成 306 位指纹：
 *   - 水平梯度   72 位（每行相邻格子明暗比较）
 *   - 垂直梯度   72 位（每列相邻格子明暗比较）
 *   - 相对亮度   81 位（每格与全图平均亮度比较）
 *   - 绝对亮度   81 位（每格与固定中点 128 比较，区分"整页换色"如白屏↔黑屏）
 * 单一方向的 dHash 对"只有纵向差异"或"纯色换色"的页面会失明，
 * 四组特征互补后任一维度的布局/明暗变化都能反映到距离上。
 *
 * 采样时裁掉顶部 8%（状态栏时钟/信号一直在变）和底部 5%（导航条），
 * 避免无关区域抖动触发误判。
 */

const GRID = 9;
const CROP_TOP = 0.08;
const CROP_BOTTOM = 0.05;

// 阈值随指纹长度(225位)标定，见 collector 内使用处
export const HASH_BITS = GRID * (GRID - 1) * 2 + GRID * GRID * 2; // 306

export function frameHash(pngBuffer) {
  const png = PNG.sync.read(pngBuffer);
  const { width, height, data } = png;

  const yStart = Math.floor(height * CROP_TOP);
  const yEnd = Math.floor(height * (1 - CROP_BOTTOM));
  const usableH = yEnd - yStart;

  // 每个网格取块内平均灰度（步长采样以控制耗时）
  const gray = new Float64Array(GRID * GRID);
  let total = 0;
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const x0 = Math.floor((gx * width) / GRID);
      const x1 = Math.floor(((gx + 1) * width) / GRID);
      const y0 = yStart + Math.floor((gy * usableH) / GRID);
      const y1 = yStart + Math.floor(((gy + 1) * usableH) / GRID);

      let sum = 0;
      let count = 0;
      const step = 4; // 块内每4个像素采1个
      for (let y = y0; y < y1; y += step) {
        for (let x = x0; x < x1; x += step) {
          const idx = (y * width + x) << 2;
          sum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          count++;
        }
      }
      const g = count > 0 ? sum / count : 0;
      gray[gy * GRID + gx] = g;
      total += g;
    }
  }
  const mean = total / (GRID * GRID);

  const bits = new Uint8Array(HASH_BITS);
  let bi = 0;
  // 水平梯度
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID - 1; gx++) {
      bits[bi++] = gray[gy * GRID + gx] > gray[gy * GRID + gx + 1] ? 1 : 0;
    }
  }
  // 垂直梯度
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID - 1; gy++) {
      bits[bi++] = gray[gy * GRID + gx] > gray[(gy + 1) * GRID + gx] ? 1 : 0;
    }
  }
  // 相对亮度 vs 全局均值
  for (let i = 0; i < GRID * GRID; i++) {
    bits[bi++] = gray[i] > mean ? 1 : 0;
  }
  // 绝对亮度 vs 固定中点
  for (let i = 0; i < GRID * GRID; i++) {
    bits[bi++] = gray[i] > 128 ? 1 : 0;
  }
  return bits;
}

export function hammingDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) d++;
  }
  return d;
}
