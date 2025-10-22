

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

// Helper: sichere Extraktion möglicher Feldnamen aus dem Foxy-Payload
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

// Vercel default export (CommonJS)
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
    const payload = typeof req.body === 'object' && req.body ? req.body : {};

    const countryRaw = getCountry(payload);
    const companyRaw = getCompany(payload);

    const country = String(countryRaw || '').toUpperCase();
    const hasCompany = Boolean(String(companyRaw || '').trim());

    // Log nur minimal für Debugging – keine personenbezogenen Daten persistieren!
    // console.log({ country, hasCompany });

    // Default: außerhalb DE keine Steuer anwenden (0%)
    let rate = 19;
    let name = 'Mehrwertsteuer';

    if (country === 'DE') {
      if (hasCompany) {
        rate = 19; // Firmenkunde in DE => 19%
        name = 'Mehrwertsteuer';
      } else {
        rate = 0; // Privatkunde in DE => 0%
        name = 'Mehrwertsteuer';
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

    res.setHeader('Content-Type', 'application/json');
    // Optional CORS für Tests
    res.setHeader('Access-Control-Allow-Origin', '*');

    return res.status(200).json(response);
  } catch (err) {
    console.error('Custom Tax Endpoint error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};