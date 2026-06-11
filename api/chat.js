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

// 航班查询（AviationStack，需要API key）
async function getFlightInfo(flightNumber) {
  const key = process.env.AVIATIONSTACK_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `http://api.aviationstack.com/v1/flights?access_key=${key}&flight_iata=${flightNumber}&limit=1`
    );
    const data = await res.json();
    if (!data.data || data.data.length === 0) return null;
    const f = data.data[0];
    return {
      flight: f.flight?.iata,
      status: f.flight_status,
      departure: {
        airport: f.departure?.airport,
        scheduled: f.departure?.scheduled,
        actual: f.departure?.actual,
        delay: f.departure?.delay
      },
      arrival: {
        airport: f.arrival?.airport,
        scheduled: f.arrival?.scheduled,
        estimated: f.arrival?.estimated,
        delay: f.arrival?.delay
      }
    };
  } catch(e) {
    return null;
  }
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
    const f = await getFlightInfo(flightMatch[0].toUpperCase());
    if (f) {
      const arrivalTime = f.arrival.estimated || f.arrival.scheduled;
      const delayMsg = f.arrival.delay ? `延误${f.arrival.delay}分钟` : '准点';
      extra += `\n\n【实时航班信息】
航班：${f.flight}，状态：${f.status}，${delayMsg}
出发：${f.departure.airport}，计划${f.departure.scheduled?.slice(11,16)}
抵达：${f.arrival.airport}，预计${arrivalTime?.slice(11,16)}
请根据航班状态给出接机建议。`;
    }
  }

  // 检测路况/交通
  if (/堵车|路况|塞车|交通|要多久|几分钟/i.test(lastMsg)) {
    extra += `\n\n【出行提示】墨尔本早高峰7:30-9:00，晚高峰4:30-6:30，CityLink/EastLink收费路段。请提醒乘客预留充裕时间。`;
  }

  return system + extra;
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
