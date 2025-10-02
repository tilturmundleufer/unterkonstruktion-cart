// Vercel Serverless Function für Foxy Cart Validation
// Steuert die Steuerhöhe abhängig vom Kundentyp (customer_type):
// - "business" | "firma" => 19% MwSt (Beispiel)
// - "private" | "privat" => 0%

export default async function handler(req, res) {
  try {
    // Body tolerant auslesen (JSON bevorzugt)
    const body = (req.body && typeof req.body === 'object') ? req.body : {};

    // customer_type aus diversen Quellen ziehen
    const fromBody = (body.customer_type || body.customerType || body.customer || '').toString().toLowerCase();
    const fromFields = (body.fields && (body.fields.customer_type || body.fields.customerType))
      ? body.fields.customer_type || body.fields.customerType
      : '';
    const fromQuery = (req.query && (req.query.customer_type || req.query.customerType))
      ? req.query.customer_type || req.query.customerType
      : '';

    const ct = (fromBody || fromFields || fromQuery || '').toString().toLowerCase();

    // Default-Tax-Logik (anpassbar):
    // Hinweis: Dies ist ein Beispiel. Passe rate/Name an euer Setup an.
    let taxes = [];
    if (ct === 'business' || ct === 'firma') {
      taxes = [{ name: 'MwSt', rate: 0.19 }];
    } else {
      taxes = []; // 0%
    }

    // Foxy erwartet ein JSON-Objekt. Weitere Felder sind möglich (Coupons, Fehler etc.).
    res.status(200).json({ taxes });
  } catch (e) {
    // Fallback: Keine Steuer anwenden
    res.status(200).json({ taxes: [] });
  }
}

export const config = { api: { bodyParser: true } };


