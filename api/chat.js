// api/chat.js - CommonJS for Vercel
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 天气查询（wttr.in，无需API key）
async function getWeather(city) {
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
async function enrichSystemPrompt(system, messages, region = {}) {
  const lastMsg = messages[messages.length - 1]?.content || '';
  let extra = '';
  const city = typeof region.city === 'string' ? region.city.trim().slice(0, 80) : '';
  const country = typeof region.country === 'string' ? region.country.trim().slice(0, 80) : '当前国家/地区';
  const currency = typeof region.currency === 'string' ? region.currency.trim().slice(0, 8) : '当地货币';

  // 检测是否需要天气
  if (/天气|下雨|温度|几度|冷不冷|热不热|带伞|穿什么|weather/i.test(lastMsg)) {
    const w = city ? await getWeather(city) : null;
    if (w) {
      extra += `\n\n【实时${city}天气】
当前：${w.temp}°C（体感${w.feels_like}°C），${w.desc}
湿度：${w.humidity}%，风速：${w.wind}km/h，UV指数：${w.uv}
明日：${w.tomorrow.minTemp}°C ~ ${w.tomorrow.maxTemp}°C，${w.tomorrow.desc}
请根据天气给出实用建议（如是否带伞、穿衣建议、出行注意等）。`;
    } else if (!city) {
      extra += '\n\n【天气查询】用户询问天气，但当前地区未知。请先请用户选择或授权定位城市。';
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



  const growthRule = '\n\n【成长型回应】如果用户提出当前还没开通的生活、工作、公共交通、出租车、Uber、拼车或其他需求，不要生硬拒绝，也不要说“我只做出行”。请温柔承接：我现在还是小朋友，先当你的小管家，帮你把订车、接送机或包车办好；以后我会有更多本领，当好你生活中的管家、工作上的助理。随后给一个当前能做的下一步，例如帮用户登记用车需求、整理行程或留下需求。';
  return `${system}\n\n【服务地区】${city || '用户当前定位地区'}，${country}；当地币种${currency}。不要套用其他国家的机场、币种或价格。` + growthRule + extra;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Chat service is not configured' });
  }

  try {
    const { system, messages, region } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages' });
    }

    // 注入实时数据到system prompt
    const enrichedSystem = await enrichSystemPrompt(system || '', messages, region || {});

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: enrichedSystem,
      messages: messages.slice(-12) // 保留最近12条
    });

    res.status(200).json(response);
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ error: 'Chat service temporarily unavailable' });
  }
};
