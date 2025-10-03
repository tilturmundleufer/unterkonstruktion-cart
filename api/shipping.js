// server.js
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

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
  return BRACKETS.at(-1).price;
}

app.post('/foxy/shipping', (req, res) => {
  if (TOKEN) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${TOKEN}`) return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body || {};
  const items = Array.isArray(body.items) ? body.items : [];
  const currency = (body.currency || 'EUR').toUpperCase();

  let totalG = 0;
  for (const it of items) {
    const q = Number(it.quantity || 0);
    const w = Number(it.weight || 0);
    totalG += toGrams(w, it.weight_uom) * q;
  }

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
    meta: { total_weight_g: Math.round(totalG) },
  };

  res.json(response);
});

app.listen(3000, () => console.log('Listening on :3000'));