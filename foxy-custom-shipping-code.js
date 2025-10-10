// FoxyCart Custom Shipping Code
// Kopiere diesen Code in Foxy Admin → Settings → Shipping → "Use custom code"

// Gewicht in Gramm umrechnen
function toGrams(weight, uom = 'g') {
  const unit = String(uom).toLowerCase();
  if (unit === 'g' || unit === 'gram' || unit === 'grams') return weight;
  if (unit === 'kg' || unit === 'kilogram' || unit === 'kilograms') return weight * 1000;
  if (['lb','lbs','pound','pounds'].includes(unit)) return weight * 453.59237;
  if (['oz','ounce','ounces'].includes(unit)) return weight * 28.349523125;
  return weight;
}

// Gewichtsbasierte Preise für neutrale Speditionslieferung
const NEUTRAL_FREIGHT_BRACKETS = [
  { minG: 0,        maxG: 100000,  price: 44.90 },
  { minG: 100001,   maxG: 200000,  price: 73.90 },
  { minG: 200001,   maxG: 300000,  price: 99.90 },
  { minG: 300001,   maxG: 500000,  price: 124.90 },
  { minG: 500001,   maxG: 750000,  price: 159.90 },
  { minG: 750001,   maxG: 1000000, price: 204.90 },
  { minG: 1000001,  maxG: 2500000, price: 236.90 },
  { minG: 2500001,  maxG: null,    price: 309.90 },
];

// Gewichtsbasierte Preise für Speditionslieferung inkl. telefonischer Avisierung
const AVISO_FREIGHT_BRACKETS = [
  { minG: 0,        maxG: 100000,  price: 29.90 },
  { minG: 100001,   maxG: 200000,  price: 55.90 },
  { minG: 200001,   maxG: 300000,  price: 79.90 },
  { minG: 300001,   maxG: 500000,  price: 99.90 },
  { minG: 500001,   maxG: 750000,  price: 129.90 },
  { minG: 750001,   maxG: 1000000, price: 169.90 },
  { minG: 1000001,  maxG: 2500000, price: 199.90 },
  { minG: 2500001,  maxG: null,    price: 269.90 },
];

function priceForWeight(g, brackets) {
  for (const b of brackets) {
    if (g >= b.minG && (b.maxG == null || g <= b.maxG)) return b.price;
  }
  return brackets[brackets.length - 1].price;
}

// Gesamtgewicht berechnen
let totalG = 0;
let noShippable = true;

if (cart['_embedded'] && cart['_embedded']['fx:items']) {
  for (let p in cart['_embedded']['fx:items']) {
    let item = cart['_embedded']['fx:items'][p];
    const q = Number(item['quantity'] || 0);
    const w = Number(item['weight'] || 0);
    const uom = item['weight_uom'] || item['weight_uom_code'] || 'g';
    
    if (w > 0 && q > 0) {
      totalG += toGrams(w, uom) * q;
      noShippable = false;
    }
  }
}

// Fallback-Gewicht wenn keine shippable Items gefunden
if (noShippable) {
  totalG = 1; // 1g Fallback
}

// Preise berechnen
const avisoPrice = priceForWeight(noShippable ? 1 : totalG, AVISO_FREIGHT_BRACKETS);
const neutralPrice = priceForWeight(noShippable ? 1 : totalG, NEUTRAL_FREIGHT_BRACKETS);

// Alle bestehenden Raten ausblenden
rates.hide();

// Neue Raten hinzufügen
rates.add(10001, avisoPrice, 'Spedition', 'Speditionslieferung inkl. telefonischer Avisierung');
rates.add(10002, 0, 'Abholung', 'Selbstabholung in 22926 Ahrensburg');
rates.add(10003, 0, 'Abholung', 'Selbstabholung in 31275 Lehrte');
rates.add(10004, neutralPrice, 'Spedition', 'neutrale Speditionslieferung inkl. telefonischer Avisierung');

// Debug-Info (wird in Foxy-Logs angezeigt)
// Custom Shipping Code: totalG, avisoPrice, neutralPrice, itemCount, country
