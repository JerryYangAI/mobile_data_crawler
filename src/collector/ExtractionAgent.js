import { EXTRACTED_FIELDS, UNRECOGNIZED } from './schema.js';

/**
 * 只看截图、只输出 JSON 的商品信息提取器。
 * 复用 DoubaoAgent.callAPI 的多模态能力，但使用独立的提取 prompt，
 * 调用链上不存在任何 Tap/Swipe/Back 执行路径。
 */
class ExtractionAgent {
  constructor(doubaoAgent, logger) {
    this.doubaoAgent = doubaoAgent;
    this.logger = logger;
  }

  buildSystemPrompt() {
    const fieldLines = EXTRACTED_FIELDS
      .map(f => `  "${f.key}": "${f.label}"`)
      .join(',\n');

    return `你是一个商品信息提取专家。用户会给你一张手机屏幕截图（通常是零售 App 或茶饮品牌小程序的商品/菜单详情页）。

你的唯一任务是：从截图中提取商品信息，输出 JSON。你不能建议或执行任何点击、滑动、返回等操作。

**输出要求（必须严格遵守）：**
1. 只输出一个 JSON 对象，不要输出任何其他文字、解释或 Markdown 代码块标记。
2. 如果当前截图是商品/饮品详情页或菜单商品页，输出以下结构（字段含义见注释）：
{
${fieldLines}
}
3. 如果当前截图不是商品页（如首页、列表页、购物车、支付页、聊天窗口、锁屏等），输出：
{"not_a_product_page": true, "reason": "简要说明当前是什么页面"}

**提取规则（CRITICAL）：**
1. 只提取截图中**清晰可见**的信息，严禁推测、联想或编造。
2. 任何看不到或看不清的字段，必须填 "${UNRECOGNIZED}"，不允许留空或猜测。
3. 价格保留截图中的原始表述（如 "¥19.9"、"19.9元/瓶"）。现价填 price，划线价/原价填 original_price。
4. claims 填商品页可见的卖点宣称（如 "0糖0脂"、"NFC鲜榨"、"当季限定"），多个用分号分隔。
5. ingredients 只有在截图中能看到配料表/成分/原料说明时才填写，看不到就填 "${UNRECOGNIZED}"。
6. 茶饮小程序的规格选项（大小杯、糖度、温度）如可见，归入 spec_volume 或 flavor。
7. 所有字段的值都必须是字符串。`;
  }

  /**
   * 从截图提取商品信息
   * @returns {Promise<{notProductPage: boolean, reason?: string, fields?: object, rawResponse: string}>}
   */
  async extract(screenshotBase64, context = {}) {
    const systemPrompt = this.buildSystemPrompt();
    let userMessage = '请提取这张截图中的商品信息，按要求只输出 JSON。';
    if (context.foregroundPackage) {
      userMessage += `\n（参考信息：当前前台应用包名为 ${context.foregroundPackage}）`;
    }

    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      // 提取是"读图抄字段"，不需要深度思考——关闭后 Seed 系列从分钟级降到秒级。
      // 个别模型不接受 thinking 参数时自动降级重调。
      let response;
      try {
        response = await this.doubaoAgent.callAPI(
          userMessage,
          systemPrompt,
          [screenshotBase64],
          { thinking: 'disabled' }
        );
      } catch (error) {
        const detail = JSON.stringify(error.response?.data || error.message || '');
        if (detail.includes('thinking')) {
          this.logger.warn('当前模型不支持 thinking 参数，降级为默认调用');
          response = await this.doubaoAgent.callAPI(userMessage, systemPrompt, [screenshotBase64]);
        } else {
          throw error;
        }
      }

      try {
        const parsed = this.parseJson(response);
        if (parsed.not_a_product_page) {
          return {
            notProductPage: true,
            reason: String(parsed.reason || '当前页面不是商品详情页'),
            rawResponse: response
          };
        }
        return { notProductPage: false, fields: parsed, rawResponse: response };
      } catch (error) {
        lastError = error;
        this.logger.warn(`提取结果 JSON 解析失败（第 ${attempt} 次）: ${error.message}`);
        userMessage += '\n\n上一次输出无法解析为 JSON，请重新输出，只输出一个合法的 JSON 对象。';
      }
    }

    throw new Error(`模型输出无法解析为 JSON: ${lastError.message}`);
  }

  /**
   * 从模型回复中提取 JSON（容忍代码块围栏和前后杂文本）
   */
  parseJson(text) {
    if (!text || !text.trim()) {
      throw new Error('模型返回内容为空');
    }
    let cleaned = text.trim().replace(/```json\s*/gi, '').replace(/```/g, '');
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('未找到 JSON 对象');
    }
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

export default ExtractionAgent;
