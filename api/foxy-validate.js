// Vercel Serverless Function: Custom Tax Endpoint for Foxy
// Regeln (Stand Til 2025-10-22):
// - Gilt NUR für Versandland = DE (Deutschland)
// - Privatkunden (kein Firmenname): 0% Steuer
// - Firmenkunden (Firmenname vorhanden): 19% Steuer
// - USt-ID wird NICHT geprüft (bewusst entfernt)

/**
 * Foxy schickt einen JSON-POST mit Cart/Customer-Daten an diesen Endpoint.
 * Wir antworten mit { taxes: [{ name, rate, apply_to_shipping? }] }.
 * Hinweis: rate ist in Prozent (19 = 19%).
 */

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
  // Vercel liefert bei application/json i.d.R. bereits geparst in req.body.
  // Falls nicht vorhanden, lesen und versuchen zu parsen (JSON oder urlencoded).
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length) {
    return req.body;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};

  const ct = (req.headers['content-type'] || '').toLowerCase();
  try {
    if (ct.includes('application/json')) {
      return JSON.parse(raw);
    }
    if (ct.includes('application/x-www-form-urlencoded')) {
      const qs = require('querystring');
      return qs.parse(raw);
    }
  } catch (e) {
    console.error('Body parse error:', e, raw.slice(0, 500));
  }
  // Fallback: versuchen JSON, sonst leer
  try { return JSON.parse(raw); } catch {}
  return {};
}

// --- Handler ---------------------------------------------------------------
module.exports = async (req, res) => {
  // CORS/Preflight (optional, hilfreich bei lokalen Tests)
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const payload = await readBody(req);

    const countryRaw = getCountry(payload);
    const companyRaw = getCompany(payload);

    const country = String(countryRaw || '').toUpperCase();
    const hasCompany = Boolean(String(companyRaw || '').trim());

    // Default: außerhalb DE -> 0% (deine Vorgabe)
    let rate = 19;
    let name = 'Steuer 19% (außerhalb DE oder Privatkunde)';

    if (country === 'DE') {
      if (hasCompany) {
        rate = 19; // Firmenkunde in DE => 19%
        name = 'Umsatzsteuer (DE) 19% – Firmenkunde';
      } else {
        rate = 0; // Privatkunde in DE => 0%
        name = 'Steuer (DE) 0% – Privatkunde';
      }
    }

    const response = {
      taxes: [
        {
          name,
          rate,
          apply_to_shipping: true,
        },
      ],
    };

    // Minimal-Logging zur Diagnose (landet in Vercel Function Logs)
    console.log('foxy-tax', {
      country,
      hasCompany,
      computedRate: rate,
      ct: req.headers['content-type'] || ''
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(response);
  } catch (err) {
    console.error('Custom Tax Endpoint error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};