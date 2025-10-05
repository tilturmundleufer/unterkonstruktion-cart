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
      billing_address2: data?.billing_address2,
      customer_email: data?.customer_email,
      custom_fields: data?.custom_fields
    });

    // Kunden-Typ ermitteln
    const lower = (v) => (v || '').toString().toLowerCase();
    let type = '';
    
    // Verschiedene Quellen für customer_type prüfen
    if (data?.customer_type) type = lower(data.customer_type);
    else if (data?.fields?.customer_type) type = lower(data.fields.customer_type);
    else if (data?.custom_fields?.length) {
      const field = data.custom_fields.find(f => 
        lower(f.name) === 'customer_type' || lower(f.name) === 'customertype'
      );
      if (field) type = lower(field.value);
    }
    else if (data?.billing_company?.startsWith('CUSTOMER_TYPE:')) {
      type = lower(data.billing_company.replace('CUSTOMER_TYPE:', ''));
    }
    else if (data?.billing_address2?.startsWith('CUSTOMER_TYPE:')) {
      type = lower(data.billing_address2.replace('CUSTOMER_TYPE:', ''));
    }
    else if (data?.customer_email?.startsWith('CUSTOMER_TYPE:')) {
      type = lower(data.customer_email.replace('CUSTOMER_TYPE:', ''));
    }
    else if (req.query?.customer_type) type = lower(req.query.customer_type);

    console.log('Detected customer_type:', type);

    // Steuerlogik: Firmenkunden = 19%, Privat = 0%
    const TAX_RATES = {
      business: { name: 'MwSt', rate: 0.19 },
      firma: { name: 'MwSt', rate: 0.19 },
      firmenkunde: { name: 'MwSt', rate: 0.19 }
    };
    
    const taxes = TAX_RATES[type] ? [{
      name: TAX_RATES[type].name,
      rate: TAX_RATES[type].rate,
      amount: 0 // Foxy berechnet den Betrag automatisch
    }] : [];

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


