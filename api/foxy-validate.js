const { parse: parseUrl } = require('url');

function readQuery(req){
  try { return parseUrl(req.url, true).query || {}; } catch { return {}; }
}

function readTotals(payload){
  const toNum = (v) => {
    const n = typeof v === 'string' ? parseFloat(v) : (typeof v === 'number' ? v : 0);
    return Number.isFinite(n) ? n : 0;
  };
  const items = toNum(payload.total_item_price);
  const shipping = toNum(payload.total_shipping);
  const futureShipping = toNum(payload.total_future_shipping);
  const discount = toNum(payload.total_discount); // meist negativ
  const ship = Math.max(Number.isFinite(shipping) ? shipping : 0, Number.isFinite(futureShipping) ? futureShipping : 0);
  return { items, shipping: ship, discount };
}
// Vercel Serverless Function: Custom Tax Endpoint for Foxy
// Regeln:
// - Nur Versandland DE relevant
// - Privatkunde (kein Firmenname) => 0%
// - Firmenkunde (Firmenname vorhanden) => 19%
// - Keine USt-ID-Prüfung

// --- Utils -----------------------------------------------------------------
function getCountry(payload) {
  const candidates = [
    'shipping_country',
    'customer_shipping_country',
    'country',
    'billing_country',
    'customer_country'
  ];
  for (const key of candidates) {
    if (payload && typeof payload[key] === 'string' && payload[key].trim()) {
      return payload[key].trim();
    }
  }
  // Try _embedded addresses
  try {
    const emb = payload && payload._embedded ? payload._embedded : null;
    if (emb) {
      const s1 = emb.shipping_address && emb.shipping_address.country;
      if (typeof s1 === 'string' && s1.trim()) return s1.trim();
      const s2 = emb['fx:shipping_address'] && emb['fx:shipping_address'].country;
      if (typeof s2 === 'string' && s2.trim()) return s2.trim();
      const b1 = emb.billing_address && emb.billing_address.country;
      if (typeof b1 === 'string' && b1.trim()) return b1.trim();
      const b2 = emb['fx:billing_address'] && emb['fx:billing_address'].country;
      if (typeof b2 === 'string' && b2.trim()) return b2.trim();
    }
  } catch {}
  return '';
}

function getCompany(payload) {
  const candidates = [
    'customer_company',
    'shipping_company',
    'billing_company',
    'company'
  ];
  for (const key of candidates) {
    if (payload && typeof payload[key] === 'string' && payload[key].trim()) {
      return payload[key].trim();
    }
  }
  // Deep lookups in _embedded (Foxy often nests objects here)
  try {
    const emb = payload && payload._embedded ? payload._embedded : null;
    if (emb) {
      // Possible shapes: emb.customer.company, emb['fx:customer'].company
      const c1 = emb.customer && emb.customer.company;
      if (typeof c1 === 'string' && c1.trim()) return c1.trim();
      const c2 = emb['fx:customer'] && emb['fx:customer'].company;
      if (typeof c2 === 'string' && c2.trim()) return c2.trim();
      // Shipping/Billing address objects
      const s1 = emb.shipping_address && emb.shipping_address.company;
      if (typeof s1 === 'string' && s1.trim()) return s1.trim();
      const s2 = emb['fx:shipping_address'] && emb['fx:shipping_address'].company;
      if (typeof s2 === 'string' && s2.trim()) return s2.trim();
      const b1 = emb.billing_address && emb.billing_address.company;
      if (typeof b1 === 'string' && b1.trim()) return b1.trim();
      const b2 = emb['fx:billing_address'] && emb['fx:billing_address'].company;
      if (typeof b2 === 'string' && b2.trim()) return b2.trim();
      // Plural collections
      const ba = emb['fx:billing_addresses'] || emb.billing_addresses || [];
      if(Array.isArray(ba)){
        for(const a of ba){ if(a && typeof a.company==='string' && a.company.trim()) return a.company.trim(); }
      }
      const sa = emb['fx:shipping_addresses'] || emb.shipping_addresses || [];
      if(Array.isArray(sa)){
        for(const a of sa){ if(a && typeof a.company==='string' && a.company.trim()) return a.company.trim(); }
      }
      const cf = emb['fx:custom_fields'] || [];
      if(Array.isArray(cf)){
        for(const f of cf){ if(f && typeof f.name==='string' && /comp/i.test(f.name) && typeof f.value==='string' && f.value.trim()) return f.value.trim(); }
      }
    }
  } catch {}
  return '';
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') {
    // Store a debug snapshot for logging
    try {
      req.__rawBody = JSON.stringify(req.body).slice(0, 4000);
      req.__contentType = req.headers['content-type'] || '';
    } catch {}
    return req.body;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  req.__rawBody = raw ? raw.slice(0, 4000) : '';
  const ct = (req.headers['content-type'] || '').toLowerCase();
  req.__contentType = ct;
  if (!raw) return {};
  try {
    if (ct.includes('application/json')) return JSON.parse(raw);
    if (ct.includes('application/x-www-form-urlencoded')) {
      const qs = require('querystring');
      return qs.parse(raw);
    }
  } catch (e) {
    console.error('Body parse error:', e);
  }
  try { return JSON.parse(raw); } catch {}
  return {};
}

function mask(value) {
  if (value == null) return value;
  const s = String(value);
  if (!s) return s;
  // Mask emails
  if (s.includes('@')) return s.replace(/(^.).*(@.*$)/, '$1***$2');
  // Mask long strings
  if (s.length > 24) return s.slice(0, 12) + '…' + s.slice(-4);
  return s;
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = mask(obj[k]);
  }
  return out;
}

function summarizePayload(payload) {
  try {
    const primary = pick(payload, [
      'shipping_country','billing_country','customer_shipping_country','customer_country',
      'customer_company','shipping_company','billing_company',
      'customer_email','shipping_email','billing_email',
      'shipping_postal_code','billing_postal_code','shipping_city','billing_city',
      'locale_code','currency_code','language'
    ]);
    const keys = Object.keys(payload || {});
    return { keys, primary };
  } catch (e) {
    return { err: String(e) };
  }
}

// --- Handler ---------------------------------------------------------------
module.exports = async (req, res) => {
  try {
    // CORS / preflight
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(200).end();
    }

    // Read payload from POST body or GET query (JSONP)
    let payload = {};
    let isGet = req.method === 'GET';
    let query = {};
    if (isGet) {
      query = readQuery(req);
      payload = query;
      // store debug snapshot for logging
      try {
        req.__rawBody = JSON.stringify(query).slice(0, 4000);
        req.__contentType = 'application/x-www-form-urlencoded?via=query';
      } catch {}
    } else if (req.method === 'POST') {
      payload = await readBody(req);
    } else {
      // Other verbs not supported
      return res.status(405).json({ error: 'Method Not Allowed. Use GET or POST.' });
    }

    const countryRaw = getCountry(payload);
    const companyRaw = getCompany(payload);

    const country = String(countryRaw || '').toUpperCase();
    const hasCompany = Boolean(String(companyRaw || '').trim());

    // --- diagnostics (sanitized) ---
    try {
      const summary = summarizePayload(payload);
      console.log('foxy-tax:incoming', {
        method: req.method,
        ct: req.__contentType || req.headers['content-type'] || '',
        rawLen: (req.__rawBody || '').length,
        rawHead: (req.__rawBody || '').slice(0, 200),
        summary
      });
      const emb = payload && payload._embedded ? payload._embedded : null;
      const embKeys = emb ? Object.keys(emb) : [];
      const companyCandidates = {
        emb_customer_company: emb && emb.customer ? emb.customer.company : undefined,
        emb_fx_customer_company: emb && emb['fx:customer'] ? emb['fx:customer'].company : undefined,
        emb_shipping_company: emb && emb.shipping_address ? emb.shipping_address.company : undefined,
        emb_fx_shipping_company: emb && emb['fx:shipping_address'] ? emb['fx:shipping_address'].company : undefined,
        emb_billing_company: emb && emb.billing_address ? emb.billing_address.company : undefined,
        emb_fx_billing_company: emb && emb['fx:billing_address'] ? emb['fx:billing_address'].company : undefined,
      };
      const ba = emb && (emb['fx:billing_addresses'] || emb.billing_addresses) || [];
      const sa = emb && (emb['fx:shipping_addresses'] || emb.shipping_addresses) || [];
      const cf = emb && emb['fx:custom_fields'] || [];
      console.log('foxy-tax:_embedded-peek', {
        embKeys,
        companyCandidates,
        ba_first: Array.isArray(ba) && ba[0] ? ba[0].company : undefined,
        sa_first: Array.isArray(sa) && sa[0] ? sa[0].company : undefined,
        cf_company: (Array.isArray(cf) && cf.find && (cf.find(x => /comp/i.test(x.name)) || {}).value) || undefined
      });
    } catch {}

    // Business rules
    let pct = 0;   // 0% default
    let name = 'Steuer (DE) 0% – Privatkunde';
    if (country === 'DE') {
      if (hasCompany) { pct = 19; name = 'Umsatzsteuer (DE) 19% – Firmenkunde'; }
      else { pct = 0; name = 'Steuer (DE) 0% – Privatkunde'; }
    } else {
      pct = 0; name = 'Steuer 0% (außerhalb DE)';
    }
    const rate = pct / 100; // decimal

    // Amount calculation (optional, helps some frontends):
    const { items, shipping, discount } = readTotals(payload);
    const taxableBase = (country === 'DE') ? (items + shipping + discount) : 0; // Versand & Rabatt berücksichtigen
    const amount = Number((taxableBase * rate).toFixed(2));

    // Build Foxy-expected payload (see research notes): ok + version + taxes[]
    const taxConfiguration = {
      ok: true,
      version: 1,
      taxes: [
        {
          name: name,
          rate: Number.isFinite(rate) ? rate : 0,
          percentage: Math.round((Number.isFinite(rate) ? rate : 0) * 100),
          rate_percentage: Math.round((Number.isFinite(rate) ? rate : 0) * 100),
          rate_decimal: Number.isFinite(rate) ? rate : 0,
          apply_to_shipping: true,
          compound: false,
          destination: 'shipping',
          type: 'percentage'
        }
      ]
    };

    console.log('foxy-tax', { country, hasCompany, pct, rate, taxableBase, amount, taxes: taxConfiguration.taxes, ct: req.__contentType || req.headers['content-type'] || '' });

    // JSONP support (older Foxy flows)
    const cb = isGet ? (query.callback || query.jsonp || '') : (payload && (payload.callback || payload.jsonp));
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    if (cb) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      return res.status(200).send(`${cb}(${JSON.stringify(taxConfiguration)})`);
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(taxConfiguration);
  } catch (err) {
    console.error('Custom Tax Endpoint error:', err);
    // Fail-safe: always return a harmless 0% response (support JSONP as well)
    try {
      const fallback = { ok: true, version: 1, taxes: [ { name: 'Steuer (Fallback 0%)', rate: 0, percentage: 0, rate_percentage: 0, rate_decimal: 0, apply_to_shipping: true, compound: false, destination: 'shipping', type: 'percentage' } ] };
      const q = readQuery(req);
      const cb = (q.callback || q.jsonp || '');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-store');
      if (cb) { res.setHeader('Content-Type', 'application/javascript; charset=utf-8'); return res.status(200).send(`${cb}(${JSON.stringify(fallback)})`); }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json(fallback);
    } catch {}
  }
};