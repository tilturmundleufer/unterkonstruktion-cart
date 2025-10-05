// Next.js API route for Foxy Custom Tax Endpoint
export default async function handler(req, res) {
  try {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

    let data = req.method === 'GET' ? req.query : req.body;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch (_) {} }
    if (data?.input && typeof data.input === 'string') { try { data = JSON.parse(data.input); } catch (_) {} }
    if (data?.cart && typeof data.cart === 'string') { try { data = JSON.parse(data.cart); } catch (_) {} }

    console.log('Tax request:', { keys: Object.keys(data || {}) });

    // Initial rollout: always return 0% so pipeline stabilisiert wird
    const taxes = [];

    console.log('Tax response:', { taxes });
    return res.status(200).json({ taxes });
  } catch (e) {
    console.error('Tax endpoint error:', e);
    return res.status(200).json({ taxes: [] });
  }
}

export const config = { api: { bodyParser: true } };