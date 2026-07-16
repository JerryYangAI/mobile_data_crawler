/**
 * FSTea 手机端数据采集模式 - 商品采集 Schema
 * 字段命名对齐 FSTea CompetitorSKU 表，导出 CSV 可直接进 FSTea Data Intake Hub
 */

export const UNRECOGNIZED = '未识别';

/**
 * 模型从截图中提取的字段（全部为字符串，看不到填 "未识别"）
 */
export const EXTRACTED_FIELDS = [
  { key: 'brand', label: '品牌' },
  { key: 'product_name', label: '商品名称' },
  { key: 'category', label: '品类' },
  { key: 'flavor', label: '口味' },
  { key: 'spec_volume', label: '规格/容量' },
  { key: 'package_type', label: '包装形式' },
  { key: 'price', label: '现价' },
  { key: 'original_price', label: '原价/划线价' },
  { key: 'promo_info', label: '促销信息' },
  { key: 'claims', label: '卖点/宣称' },
  { key: 'ingredients', label: '配料/成分' },
  { key: 'rating', label: '评分' },
  { key: 'review_count', label: '评价数' },
  { key: 'shop_name', label: '店铺/门店' }
];

/**
 * 系统自动填充的元数据字段
 */
export const SYSTEM_FIELDS = [
  { key: 'capture_id', label: '采集ID' },
  { key: 'captured_at', label: '采集时间' },
  { key: 'source_app', label: '来源渠道' },
  { key: 'source_package', label: '来源包名' },
  { key: 'collection_batch', label: '采集批次' },
  { key: 'screenshot_file', label: '截图文件' },
  { key: 'device_serial', label: '设备序列号' },
  { key: 'extraction_model', label: '提取模型' },
  { key: 'duplicate_of', label: '重复于' },
  { key: 'review_status', label: '复核状态' },
  { key: 'notes', label: '备注' }
];

export const ALL_FIELDS = [...SYSTEM_FIELDS, ...EXTRACTED_FIELDS];

/**
 * 已知 App 包名 -> 渠道名映射（识别不到时保留包名，前端可手工修正）
 */
export const PACKAGE_CHANNEL_MAP = {
  'com.wudaokou.hippo': '盒马',
  'com.xstore.sevenfresh': '七鲜',
  'com.yaya.zone': '叮咚买菜',
  'com.pupumall.customer': '朴朴超市',
  'cn.samsclub.app': '山姆会员商店',
  'com.dm.metro': '麦德龙',
  'com.meituan.retail.v.android': '小象超市',
  'cn.walmart.app': '沃尔玛',
  'com.jingdong.app.mall': '京东',
  'com.taobao.taobao': '淘宝',
  'com.xunmeng.pinduoduo': '拼多多',
  'com.sankuai.meituan': '美团',
  'me.ele': '饿了么',
  'com.tencent.mm': '微信小程序'
};

export function resolveChannel(packageName) {
  if (!packageName) return UNRECOGNIZED;
  return PACKAGE_CHANNEL_MAP[packageName] || packageName;
}

/**
 * 品牌规范化：模型对同一品牌会写出多种名称
 * （"奈雪/NAIXUE/奈雪（naisnow）"），统一映射到规范名，
 * 否则 FStea 侧按品牌统计会碎成几十个假品牌。
 * 规则为包含匹配（先命中先得），未命中保留原值。
 */
export const BRAND_CANONICAL_RULES = [
  ['奈雪的茶', ['奈雪', 'naixue', 'naisnow']],
  ['瑞幸咖啡', ['瑞幸', 'luckin']],
  ['霸王茶姬', ['霸王茶姬', 'chagee']],
  ['茶颜悦色', ['茶颜悦色', '茶叶子']],
  ['茉莉奶白', ['茉莉奶白', 'molly']],
  ['爷爷不泡茶', ['爷爷不泡茶', 'yeye', 'no ye']],
  ['沪上阿姨', ['沪上阿姨', 'auntea']],
  ['满记甜品', ['满记']],
  ['茶百道', ['茶百道', 'chapanda']],
  ['阿嬷手作', ['阿嬷手作', '阿姆手作']],
  ['喜茶', ['喜茶', 'heytea']],
  ['蜜雪冰城', ['蜜雪冰城', 'mixue']],
  ['古茗', ['古茗', 'goodme']],
  ['乐乐茶', ['乐乐茶', 'lelecha']]
];

export function canonicalBrand(brand) {
  if (!brand || brand === UNRECOGNIZED) return UNRECOGNIZED;
  const lower = String(brand).toLowerCase();
  for (const [canon, keywords] of BRAND_CANONICAL_RULES) {
    if (keywords.some(k => lower.includes(k))) return canon;
  }
  return String(brand).trim();
}

/**
 * 校验并规范化一条采集记录：
 * - 提取字段缺失或为空 -> 填 "未识别"
 * - 所有值统一转字符串（保留模型输出的原始表述，如 "¥19.9"）
 * - 品牌名归一化到规范名
 */
export function normalizeRecord(record) {
  const normalized = { ...record };
  for (const field of EXTRACTED_FIELDS) {
    const value = normalized[field.key];
    if (value === undefined || value === null || String(value).trim() === '') {
      normalized[field.key] = UNRECOGNIZED;
    } else {
      normalized[field.key] = String(value).trim();
    }
  }
  normalized.brand = canonicalBrand(normalized.brand);
  return normalized;
}

/**
 * 去重指纹：同渠道 + 同品牌 + 同名视为同一商品。
 * - 含渠道：盒马和奥乐齐都卖的同款商品是两个价格点，不能互判重复；
 *   茶饮小程序渠道都是"微信小程序"，此维度对它们无影响，靠品牌区分
 * - 含品牌：防止古茗和蜜雪的同名商品（茉莉奶绿）误判重复（实测教训）
 * - 不含规格：模型对同一页面两次提取的规格措辞会漂移，
 *   把规格算进指纹会漏判重复（实测教训）；
 *   零售 SKU 的容量差异通常已体现在商品名里
 */
export function fingerprint(record) {
  return [record.source_app, canonicalBrand(record.brand), record.product_name]
    .map(v => String(v || '').trim())
    .join('||');
}
