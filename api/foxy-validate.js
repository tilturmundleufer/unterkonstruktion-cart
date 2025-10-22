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
    // Allow POST only (Foxy ruft als Server an; kein JSONP nötig)
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(200).end();
    }
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
    }

    const payload = await readBody(req);

    const countryRaw = getCountry(payload);
    const companyRaw = getCompany(payload);

    const country = String(countryRaw || '').toUpperCase();
    const hasCompany = Boolean(String(companyRaw || '').trim());

    // --- Detailed diagnostic log (sanitized) ---
    try {
      const summary = summarizePayload(payload);
      console.log('foxy-tax:incoming', {
        method: req.method,
        ct: req.__contentType || req.headers['content-type'] || '',
        rawLen: (req.__rawBody || '').length,
        rawHead: (req.__rawBody || '').slice(0, 200),
        summary
      });
    } catch {}

    // Geschäftslogik
    let pct = 0; // Prozentangabe (0 oder 19)
    let name = 'Steuer (DE) 0% – Privatkunde';

    if (country === 'DE') {
      if (hasCompany) {
        pct = 19;
        name = 'Umsatzsteuer (DE) 19% – Firmenkunde';
      } else {
        pct = 0;
        name = 'Steuer (DE) 0% – Privatkunde';
      }
    } else {
      // Außerhalb DE laut Vorgabe 0%
      pct = 0;
      name = 'Steuer 0% (außerhalb DE)';
    }

    // Viele Integrationen erwarten Dezimalrate (z.B. 0.19). Wir liefern beides:
    const fractional = pct / 100; // 0 oder 0.19

    const response = {
      // Einige Foxy-Installationen mögen zusätzliche Meta-Felder
      ok: true,
      version: 1,
      taxes: [
        {
          name,
          rate: fractional, // Dezimal (0.19)
          percentage: pct,  // Hinweis (19)
          apply_to_shipping: true,
          type: 'percentage'
        }
      ]
    };

    console.log('foxy-tax', {
      country,
      hasCompany,
      percentage: pct,
      rate: fractional,
      ct: req.headers['content-type'] || ''
    });

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(response);
  } catch (err) {
    console.error('Custom Tax Endpoint error:', err);
    // Niemals 500 an Foxy zurückgeben, sondern eine harmlose 0%-Antwort,
    // damit der Checkout nicht „Tax System Error“ zeigt.
    try {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({ ok: false, version: 1, taxes: [{ name: 'Steuer (Fallback 0%)', rate: 0, percentage: 0, apply_to_shipping: true }] });
    } catch {}
  }
};