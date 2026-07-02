// api/tts.js - SiliconFlow CosyVoice2 TTS, CommonJS for Vercel

const MODEL = 'FunAudioLLM/CosyVoice2-0.5B';
const DEFAULT_VOICE = 'FunAudioLLM/CosyVoice2-0.5B:diana';

const ALLOWED_VOICES = new Set([
  'FunAudioLLM/CosyVoice2-0.5B:diana',
  'FunAudioLLM/CosyVoice2-0.5B:charles',
]);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.SILICONFLOW_API_KEY) {
    return res.status(500).json({ error: 'TTS service is not configured' });
  }

  try {
    const {
      text,
      voice = DEFAULT_VOICE,
    } = req.body || {};

    if (typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    const clean = text
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);

    if (!clean) {
      return res.status(400).json({ error: 'Text is empty' });
    }

    if (!ALLOWED_VOICES.has(voice)) {
      return res.status(400).json({ error: 'Unsupported voice' });
    }

    const response = await fetch('https://api.siliconflow.cn/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SILICONFLOW_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        input: clean,
        voice,
        response_format: 'mp3',
        speed: 1.0,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      console.error('SiliconFlow TTS failed:', response.status, message.slice(0, 500));
      return res.status(502).json({ error: 'SiliconFlow TTS upstream failed', status: response.status, detail: message.slice(0, 500) });
    }

    const audioBuffer = await response.arrayBuffer();
    const audio = Buffer.from(audioBuffer).toString('base64');

    return res.status(200).json({ audio, format: 'mp3' });
  } catch (error) {
    console.error('TTS handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
