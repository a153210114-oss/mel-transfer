// api/video-image.js - Generate video workshop images with OpenAI, CommonJS for Vercel

const DEFAULT_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';

function allowCors(req, res) {
  const origin = req.headers.origin || '';
  const allowedOrigins = new Set([
    'null',
    'https://www.huabanapp.com',
    'https://huabanapp.com',
    'http://localhost:4173',
    'http://localhost:4174',
  ]);
  if (!origin || allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || 'https://www.huabanapp.com');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function cleanPrompt(value = '') {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1800);
}

module.exports = async function handler(req, res) {
  allowCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Image generation is not configured' });
  }

  try {
    const { prompt, title, style = 'realistic', size = '1024x1536' } = req.body || {};
    const clean = cleanPrompt(prompt);
    const cleanTitle = cleanPrompt(title).slice(0, 80);
    if (!clean) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const finalPrompt = [
      'Create a vertical 9:16 video frame image for a Chinese-language short video.',
      cleanTitle ? `Video topic: ${cleanTitle}.` : '',
      `Main visual request: ${clean}.`,
      `Style: ${style}.`,
      'Composition: cinematic, clear subject, clean background, natural lighting, practical real-life feeling.',
      'Audience: overseas Chinese users. The image should feel trustworthy, warm, and useful.',
      'Avoid: unreadable text, watermarks, messy UI, over-stylized advertising, exaggerated facial expressions.',
      'Do not place important text in the image; leave room for subtitles and app overlay.'
    ].filter(Boolean).join('\n');

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        prompt: finalPrompt,
        size,
        quality: 'low',
        output_format: 'jpeg',
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      console.error('OpenAI image generation failed:', response.status, message.slice(0, 500));
      return res.status(502).json({ error: 'Image generation temporarily unavailable' });
    }

    const data = await response.json();
    const image = data?.data?.[0]?.b64_json;
    if (!image) {
      return res.status(502).json({ error: 'No image returned' });
    }

    return res.status(200).json({
      image,
      mimeType: 'image/jpeg',
      model: DEFAULT_MODEL,
      prompt: finalPrompt,
      huaban_usage: {
        provider: 'openai',
        model: DEFAULT_MODEL,
        endpoint: 'video-image',
        request_id: data.id || '',
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        text_chars: finalPrompt.length
      }
    });
  } catch (error) {
    console.error('Video image API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
