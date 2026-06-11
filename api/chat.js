// api/chat.js - CommonJS for Vercel
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 天气查询（wttr.in，无需API key）
async function getWeather(city = 'Melbourne') {
  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
    const data = await res.json();
    const current = data.current_condition[0];
    const weather = data.weather[0];
    return {
      temp: current.temp_C,
      feels_like: current.FeelsLikeC,
      desc: current.weatherDesc[0].value,
      humidity: current.humidity,
      wind: current.windspeedKmph,
      uv: current.uvIndex,
      tomorrow: {
        maxTemp: weather.maxtempC,
        minTemp: weather.mintempC,
        desc: weather.hourly[4]?.weatherDesc[0]?.value || ''
      }
    };
  } catch(e) {
    return null;
  }
}

// 航班查询 - 直接给FlightAware链接
function getFlightLink(flightNumber) {
  const fn = flightNumber.toUpperCase().replace(/\s/g, '');
  return {
    flightAware: `https://www.flightaware.com/live/flight/${fn}`,
    flight: fn
  };
}

// 构建工具结果注入到系统提示
async function enrichSystemPrompt(system, messages) {
  const lastMsg = messages[messages.length - 1]?.content || '';
  let extra = '';

  // 检测是否需要天气
  if (/天气|下雨|温度|几度|冷不冷|热不热|带伞|穿什么|weather/i.test(lastMsg)) {
    const w = await getWeather('Melbourne');
    if (w) {
      extra += `\n\n【实时墨尔本天气】
当前：${w.temp}°C（体感${w.feels_like}°C），${w.desc}
湿度：${w.humidity}%，风速：${w.wind}km/h，UV指数：${w.uv}
明日：${w.tomorrow.minTemp}°C ~ ${w.tomorrow.maxTemp}°C，${w.tomorrow.desc}
请根据天气给出实用建议（如是否带伞、穿衣建议、出行注意等）。`;
    }
  }

  // 检测航班号（如QF1, VA443, CX101等）
  const flightMatch = lastMsg.match(/([A-Z]{2}\d{3,4}|[A-Z]{3}\d{3,4})/i);
  if (flightMatch) {
    const f = getFlightLink(flightMatch[0]);
    extra += `\n\n【航班查询】
用户提到航班 ${f.flight}，请告知：
1. 可以在 FlightAware 查看实时状态：${f.flightAware}
2. 建议出关后再联系司机确认接机时间
3. 如果航班延误，司机会等待，请保持联系`;
  }



  const noTransitRule = '\n\n【重要限制】不提供任何公共交通、出租车、Uber、拼车等地面交通信息和建议。如用户询问，礼貌说明我们专注私人接送服务。';
  return system + noTransitRule + extra;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { system, messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages' });
    }

    // 注入实时数据到system prompt
    const enrichedSystem = await enrichSystemPrompt(system || '', messages);

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      system: enrichedSystem,
      messages: messages.slice(-12) // 保留最近12条
    });

    res.status(200).json(response);
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ error: error.message });
  }
};
