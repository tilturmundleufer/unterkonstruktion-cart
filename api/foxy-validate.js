// Vercel Serverless Function für Foxy Cart Validation
// Steuert die Steuerhöhe abhängig vom Kundentyp (customer_type):
// - "business" | "firma" => 19% MwSt (Beispiel)
// - "private" | "privat" => 0%

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

    // Body tolerant auslesen (JSON bevorzugt)
    let body = req.body || {};
    
    // Robusteres Body-Parsing für verschiedene Foxy-Formate
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        // ignore, try to parse from 'input' or 'cart' field
      }
    }
    if (body.input && typeof body.input === 'string') {
      try {
        body = JSON.parse(body.input);
      } catch (e) { /* ignore */ }
    } else if (body.cart && typeof body.cart === 'string') {
      try {
        body = JSON.parse(body.cart);
      } catch (e) { /* ignore */ }
    }

    // Debug: Log für Entwicklung
    console.log('Tax request:', { 
      keys: Object.keys(body || {}), 
      customer_type: body.customer_type,
      fields: body.fields,
      custom_fields: body.custom_fields
    });

    // customer_type aus diversen Quellen ziehen
    let customerType = '';
    
    // Direkt aus body
    if (body.customer_type) {
      customerType = body.customer_type.toString().toLowerCase();
    }
    // Aus fields
    else if (body.fields && body.fields.customer_type) {
      customerType = body.fields.customer_type.toString().toLowerCase();
    }
    // Aus custom_fields
    else if (body.custom_fields && Array.isArray(body.custom_fields)) {
      for (const field of body.custom_fields) {
        if (field.name === 'customer_type' || field.name === 'customerType') {
          customerType = field.value.toString().toLowerCase();
          break;
        }
      }
    }
    // Aus query params
    else if (req.query && (req.query.customer_type || req.query.customerType)) {
      customerType = (req.query.customer_type || req.query.customerType).toString().toLowerCase();
    }

    console.log('Detected customer_type:', customerType);

    // Tax-Logik
    let taxes = [];
    if (customerType === 'business' || customerType === 'firma' || customerType === 'firmenkunde') {
      taxes = [{ 
        name: 'MwSt', 
        rate: 0.19,
        amount: 0 // Foxy berechnet den Betrag automatisch
      }];
    } else {
      taxes = []; // 0% für Privatkunden
    }

    const response = { taxes };
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    console.log('Tax response:', response);
    return res.status(200).json(response);
    
  } catch (e) {
    console.error('Tax endpoint error:', e);
    // Fallback: Keine Steuer anwenden
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ taxes: [] });
  }
}

export const config = { api: { bodyParser: true } };


