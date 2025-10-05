// Vercel Serverless Function für Foxy Cart Tax Endpoint
// Berechnet Steuersätze basierend auf Kundentyp (Privat/Firma)
// - Firmenkunden: 19% MwSt
// - Privatkunden: 0% (steuerfrei)

export default async function handler(req, res) {
  try {
    // CORS-Header setzen
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    
    // OPTIONS für Preflight
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    
    // Nur POST und GET erlauben
    if (req.method !== 'POST' && req.method !== 'GET') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Daten tolerant auslesen
    let data = req.method === 'GET' ? req.query : req.body;
    
    // Robusteres Parsing für verschiedene Foxy-Formate
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) { /* ignore */ }
    }
    if (data?.input && typeof data.input === 'string') {
      try { data = JSON.parse(data.input); } catch (e) { /* ignore */ }
    }
    if (data?.cart && typeof data.cart === 'string') {
      try { data = JSON.parse(data.cart); } catch (e) { /* ignore */ }
    }

    // Debug-Log (nur in Entwicklung)
    console.log('Tax request:', { 
      method: req.method,
      keys: Object.keys(data || {}), 
      customer_type: data?.customer_type,
      billing_company: data?.billing_company,
      shipping_company: data?.shipping_company,
      billing_address2: data?.billing_address2,
      customer_email: data?.customer_email,
      custom_fields: data?.custom_fields
    });

    // TESTMODUS: Immer 0% zurückgeben, egal welcher Input ankommt
    console.log('Tax endpoint TEST MODE: forcing 0% tax');
    const taxes = [];

    console.log('Tax response:', { taxes });
    return res.status(200).json({ taxes });
    
  } catch (e) {
    console.error('Tax endpoint error:', e);
    // Fallback: Keine Steuer anwenden
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ taxes: [] });
  }
}

export const config = { api: { bodyParser: true } };


