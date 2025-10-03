// Next.js API Route für Foxy Custom Shipping Endpoint
const TOKEN = process.env.FOXY_SHIPPING_TOKEN;

function toGrams(weight, uom = 'g') {
  const unit = String(uom).toLowerCase();
  if (unit === 'g' || unit === 'gram' || unit === 'grams') return weight;
  if (unit === 'kg' || unit === 'kilogram' || unit === 'kilograms') return weight * 1000;
  if (['lb','lbs','pound','pounds'].includes(unit)) return weight * 453.59237;
  if (['oz','ounce','ounces'].includes(unit)) return weight * 28.349523125;
  return weight;
}

const BRACKETS = [
  { minG: 0,        maxG: 100000,  price: 44.90 },
  { minG: 100001,   maxG: 200000,  price: 73.90 },
  { minG: 200001,   maxG: 300000,  price: 99.90 },
  { minG: 300001,   maxG: 500000,  price: 124.90 },
  { minG: 500001,   maxG: 750000,  price: 159.90 },
  { minG: 750001,   maxG: 1000000, price: 204.90 },
  { minG: 1000001,  maxG: 2500000, price: 236.90 },
  { minG: 2500001,  maxG: null,    price: 309.90 },
];

function priceForWeight(g) {
  for (const b of BRACKETS) {
    if (g >= b.minG && (b.maxG == null || g <= b.maxG)) return b.price;
  }
  return BRACKETS[BRACKETS.length - 1].price;
}

export default async function handler(req, res) {
  try {
    // CORS für Preflight
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      return res.status(204).end();
    }

    // Nur POST erlauben
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Auth prüfen
    if (TOKEN) {
      const auth = req.headers.authorization || '';
      if (auth !== `Bearer ${TOKEN}`) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    const currency = (body.currency || 'EUR').toUpperCase();

    // Gesamtgewicht berechnen
    let totalG = 0;
    for (const it of items) {
      const q = Number(it.quantity || 0);
      const w = Number(it.weight || 0);
      const uom = it.weight_uom || it.weight_uom_code || 'g';
      totalG += toGrams(w, uom) * q;
    }

    // Debug: Log für Entwicklung
    console.log('Shipping request:', { items, totalG, currency });

    const response = {
      rates: [
        {
          service_id: 'freight_aviso',
          service_description: 'neutrale Speditionslieferung inkl. telefonischer Avisierung',
          price: priceForWeight(totalG),
          currency,
        },
      ],
      messages: [],
      meta: { 
        total_weight_g: Math.round(totalG),
        computed_at: new Date().toISOString()
      },
    };

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(response);

  } catch (error) {
    console.error('Shipping endpoint error:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    });
  }
}

// Next.js bodyParser aktivieren
export const config = { api: { bodyParser: true } };