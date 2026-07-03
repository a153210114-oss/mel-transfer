// api/image-wish.js - extract wish-wall draft from an uploaded image
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function safeJson(text) {
  const raw = String(text || '').trim();
  try { return JSON.parse(raw); } catch(e) {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch(e) { return null; }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Image service is not configured' });
  }

  try {
    const { image, mediaType, city, country } = req.body || {};
    if (!image || !mediaType) {
      return res.status(400).json({ error: 'Missing image' });
    }

    const prompt = `你是华伴 AI 的图片需求/供给情报识别器。请读取图片中的中文/英文信息，判断它是否适合整理成公开搜索、核验和匹配任务。

当前城市：${city || '未知'}，国家/地区：${country || '未知'}。

请只返回 JSON，不要解释。字段：
{
  "wishType": "need_paid | need_free | offer_free | sell",
  "category": "旅游转让 | 拼团补位 | 票券/名额转让 | 维修上门 | 本地找人 | 接送陪同 | 翻译沟通 | 临时跑腿 | 其他互助",
  "city": "城市或地区",
  "text": "整理后的任务说明，保留日期、地点、服务内容、亮点、限制、备注等关键信息",
  "budget": "价格/预算/可议/免费/未知",
  "title": "一句短标题",
  "confidence": 0.0
}

规则：
- 如果是广告海报、行程变更、客户行程有变、需要出掉行程、拼团补位、票券名额转让，优先 wishType=sell 或 need_paid，category=旅游转让/拼团补位/票券/名额转让。
- 如果是找电工、水管、维修、跑腿、搬运、上门检查，优先 wishType=need_paid。
- 如果看不清，text 里说明“图片部分信息不清楚，请补充...”。
- 不要编造图片中没有的联系电话。`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: image
            }
          },
          { type: 'text', text: prompt }
        ]
      }]
    });

    const text = response.content?.map(part => part.text || '').join('\n') || '';
    const draft = safeJson(text);
    if (!draft) return res.status(502).json({ error: 'Could not parse image result' });
    res.status(200).json({ draft });
  } catch (error) {
    console.error('Image wish API error:', error);
    res.status(500).json({ error: 'Image recognition temporarily unavailable' });
  }
};
