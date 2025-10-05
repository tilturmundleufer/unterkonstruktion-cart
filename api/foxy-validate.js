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

    // Steuerlogik: Nur noch anhand Firma (leer => 0%, gesetzt => 19%)
    const getString = (v) => (v == null ? '' : String(v));
    // Aus _embedded zusätzliche Company-Werte lesen
    let embeddedBillingCompany = '';
    let embeddedShippingCompany = '';
    try {
      const emb = data?._embedded || {};
      embeddedBillingCompany = getString(emb['fx:billing_address']?.company).trim();
      embeddedShippingCompany = getString(emb['fx:shipment']?.company || emb['fx:shipping_address']?.company).trim();
    } catch(e) {}

    // Priorität: flache Felder, dann embedded
    const companyRaw = (
      getString(data?.billing_company).trim() ||
      getString(data?.shipping_company).trim() ||
      embeddedBillingCompany ||
      embeddedShippingCompany
    );
    const isBusiness = companyRaw.length > 0;

    console.log('Detected company (business?):', { company: companyRaw, embeddedBillingCompany, embeddedShippingCompany, isBusiness });

    const taxes = isBusiness ? [{ name: 'MwSt', rate: 0.19, amount: 0 }] : [];

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


