// api/shipping.ts – Foxy Custom Shipping Endpoint (Next.js API Route kompatibel)
declare const process: any;

/**
 * Optional: einfacher Schutz via Bearer-Token (setze FOXY_SHIPPING_TOKEN in den Vercel-Env-Variablen).
 * Trage das Token im Foxy-Admin beim Custom Shipping Endpoint als Header ein:
 *   Authorization: Bearer <DEIN_TOKEN>
 */
function assertAuth(req: any) {
  const token = process.env.FOXY_SHIPPING_TOKEN;
  if (!token) return; // wenn kein Token gesetzt ist, keine Prüfung
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${token}`) {
    const err: any = new Error('Unauthorized');
    err.statusCode = 401;
    throw err;
  }
}

// robuste Einheiten-Konvertierung -> Gramm
function toGrams(weight: number, uom?: string): number {
  const unit = (uom || 'g').toLowerCase();
  if (unit === 'g' || unit === 'gram' || unit === 'grams') return weight;
  if (unit === 'kg' || unit === 'kilogram' || unit === 'kilograms') return weight * 1000;
  if (unit === 'lb' || unit === 'lbs' || unit === 'pound' || unit === 'pounds') return weight * 453.59237;
  if (unit === 'oz' || unit === 'ounce' || unit === 'ounces') return weight * 28.349523125;
  return weight; // fallback: schon in g
}

// deine Stufen
const BRACKETS: { minG: number; maxG: number | null; price: number }[] = [
  { minG: 0,        maxG: 100000,   price: 44.90 },
  { minG: 100001,   maxG: 200000,   price: 73.90 },
  { minG: 200001,   maxG: 300000,   price: 99.90 },
  { minG: 300001,   maxG: 500000,   price: 124.90 },
  { minG: 500001,   maxG: 750000,   price: 159.90 },
  { minG: 750001,   maxG: 1000000,  price: 204.90 },
  { minG: 1000001,  maxG: 2500000,  price: 236.90 },
  { minG: 2500001,  maxG: null,     price: 309.90 }, // unendlich
];

function priceForWeight(totalGrams: number): number {
  for (const b of BRACKETS) {
    const withinMin = totalGrams >= b.minG;
    const withinMax = b.maxG == null ? true : totalGrams <= b.maxG;
    if (withinMin && withinMax) return b.price;
  }
  // Fallback (sollte nie passieren)
  return BRACKETS[BRACKETS.length - 1].price;
}

/**
 * Erwarteter Foxy-Request (vereinfachtes Schema):
 * {
 *   "shipto": { "country": "DE", ... },
 *   "items": [
 *     { "quantity": 2, "weight": 1200, "weight_uom": "g", ... },
 *     ...
 *   ],
 *   "currency": "EUR"
 * }
 * Foxy ist tolerant; wir lesen defensiv.
 */
export default async function handler(req: any, res: any) {
  try {
    assertAuth(req);

    // Preflight / CORS optional zulassen (falls Foxy per Browser testet)
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      return res.status(204).end();
    }

    // Foxy schickt JSON
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Next.js API-Routes parsen Body bereits, aber bei Raw-Fallback tolerieren
    let body: any = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const items: any[] = Array.isArray(body.items) ? body.items : [];
    const currency = (body.currency || 'EUR').toUpperCase();

    // Gesamtgewicht ermitteln
    let totalGrams = 0;
    for (const it of items) {
      const qty = Number(it.quantity || 0);
      const w   = Number(it.weight || 0);
      const uom = it.weight_uom || it.weight_uom_code || 'g';
      totalGrams += toGrams(w, uom) * qty;
    }

    // Rate bestimmen
    const amount = priceForWeight(totalGrams);

    // Foxy-Response (generisches, kompatibles Format)
    const response = {
      rates: [
        {
          service_id: 'freight_aviso',
          service_description: 'neutrale Speditionslieferung inkl. telefonischer Avisierung',
          price: amount,
          currency,
          // optional:
          // min_delivery_date: null,
          // max_delivery_date: null
        },
      ],
      messages: [], // z.B. Hinweise an den Kunden
      meta: {
        total_weight_g: Math.round(totalGrams),
        computed_at: new Date().toISOString(),
      },
    };

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(response);
  } catch (err: any) {
    const code = err?.statusCode || 500;
    return res.status(code).json({
      error: err?.message || 'Internal Server Error',
    });
  }
}

// Next.js bodyParser aktivieren (Standard), hier explizit belassen
export const config = { api: { bodyParser: true } };