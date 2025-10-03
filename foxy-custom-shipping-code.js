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

// Gewichtsbasierte Preise
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
const basePrice = priceForWeight(totalG);

// Alle bestehenden Raten ausblenden
rates.hide();

// Neue Raten hinzufügen
rates.add(10001, basePrice, 'Spedition', 'neutrale Speditionslieferung inkl. telefonischer Avisierung');
rates.add(10002, 0, 'Abholung', 'Berlin (kostenlos)');
rates.add(10003, 0, 'Abholung', 'Wedding (kostenlos)');

// Debug-Info (wird in Foxy-Logs angezeigt)
console.log('Custom Shipping Code:', {
  totalG: totalG,
  basePrice: basePrice,
  itemCount: cart['_embedded'] ? cart['_embedded']['fx:items'].length : 0,
  country: cart['_embedded'] && cart['_embedded']['fx:shipment'] ? cart['_embedded']['fx:shipment']['country'] : 'unknown'
});
