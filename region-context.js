(function (global) {
  'use strict';

  const STORAGE_KEY = 'travel_region';
  const DEFAULT_REGION = {
    countryCode: 'AU', country: '澳大利亚', city: '墨尔本',
    lat: -37.8136, lng: 144.9631, currency: 'AUD', symbol: 'A$', callingCode: '+61'
  };
  const CORE = {
    AU:['AUD','A$','+61'], NZ:['NZD','NZ$','+64'], US:['USD','US$','+1'], CA:['CAD','C$','+1'],
    GB:['GBP','£','+44'], SG:['SGD','S$','+65'], MY:['MYR','RM','+60'], JP:['JPY','¥','+81'],
    KR:['KRW','₩','+82'], TH:['THB','฿','+66'], AE:['AED','AED','+971'], CN:['CNY','¥','+86'],
    HK:['HKD','HK$','+852'], MO:['MOP','MOP$','+853'], TW:['TWD','NT$','+886'],
    FR:['EUR','€','+33'], DE:['EUR','€','+49'], IT:['EUR','€','+39'], ES:['EUR','€','+34'],
    NL:['EUR','€','+31'], IE:['EUR','€','+353'], PT:['EUR','€','+351'], AT:['EUR','€','+43'],
    BE:['EUR','€','+32'], FI:['EUR','€','+358'], GR:['EUR','€','+30'], CH:['CHF','CHF','+41'],
    IN:['INR','₹','+91'], PH:['PHP','₱','+63'], ID:['IDR','Rp','+62'], VN:['VND','₫','+84'],
    MX:['MXN','MX$','+52'], BR:['BRL','R$','+55'], ZA:['ZAR','R','+27']
  };

  function load() {
    try { return { ...DEFAULT_REGION, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
    catch (_) { return { ...DEFAULT_REGION }; }
  }

  function save(region) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(region));
    global.dispatchEvent(new CustomEvent('travel-region-change', { detail: region }));
    return region;
  }

  async function countryMeta(countryCode) {
    const code = String(countryCode || 'AU').toUpperCase();
    if (CORE[code]) {
      const [currency, symbol, callingCode] = CORE[code];
      return { currency, symbol, callingCode };
    }
    const cacheKey = `country_meta_${code}`;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (cached) return cached;
      const response = await fetch(`https://restcountries.com/v3.1/alpha/${encodeURIComponent(code)}?fields=currencies,idd`);
      if (!response.ok) throw new Error('country metadata unavailable');
      const data = await response.json();
      const currency = Object.keys(data.currencies || {})[0] || 'USD';
      const symbol = data.currencies?.[currency]?.symbol || currency;
      const root = data.idd?.root || '';
      const suffix = data.idd?.suffixes?.length === 1 ? data.idd.suffixes[0] : '';
      const meta = { currency, symbol, callingCode: root + suffix };
      localStorage.setItem(cacheKey, JSON.stringify(meta));
      return meta;
    } catch (_) {
      return { currency: load().currency || 'USD', symbol: load().symbol || '$', callingCode: '' };
    }
  }

  async function resolve(region) {
    const meta = await countryMeta(region.countryCode);
    return save({ ...load(), ...region, ...meta, countryCode: String(region.countryCode || 'AU').toUpperCase() });
  }

  function formatMoney(value, region = load()) {
    const number = Number(value || 0);
    try {
      return new Intl.NumberFormat(navigator.language || 'zh-CN', {
        style: 'currency', currency: region.currency, currencyDisplay: 'code',
        maximumFractionDigits: Number.isInteger(number) ? 0 : 2
      }).format(number);
    } catch (_) { return `${region.currency || ''} ${number}`.trim(); }
  }

  function phonePlaceholder(region = load()) {
    return region.callingCode ? `${region.callingCode} 手机号` : '国际手机号（含国家区号）';
  }

  function normalizePhone(value, region = load()) {
    let phone = String(value || '').trim().replace(/[\s()-]/g, '');
    if (phone.startsWith('00')) phone = '+' + phone.slice(2);
    if (!phone.startsWith('+') && region.callingCode) phone = region.callingCode + phone.replace(/^0+/, '');
    return phone;
  }

  global.WorldRegion = { DEFAULT_REGION, load, save, resolve, countryMeta, formatMoney, phonePlaceholder, normalizePhone };
})(window);
