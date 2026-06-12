// api/tts.js - SiliconFlow CosyVoice2 TTS, CommonJS
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { text, voice = 'FunAudioLLM/CosyVoice2-0.5B:diana', dialect } = req.body;
    if (!text) return res.status(400).json({ error: 'No text' });

    const clean = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 500);
    if (!clean) return res.status(400).json({ error: 'Empty text' });

    // 方言instruct模式：在文字前加指令
    const dialectMap = {
      cantonese: '用粤语说这句话',
      mandarin: '',
    };
    const instruction = dialect && dialectMap[dialect] ? dialectMap[dialect] : '';
    const input = instruction ? `${instruction}<|endofprompt|>${clean}` : clean;

    const response = await fetch('https://api.siliconflow.cn/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SILICONFLOW_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'FunAudioLLM/CosyVoice2-0.5B',
        input,
        voice,
        response_format: 'mp3',
        speed: 1.0
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'TTS failed: ' + err.slice(0, 200) });
    }

    const audioBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(audioBuffer).toString('base64');
    res.status(200).json({ audio: base64, format: 'mp3' });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
