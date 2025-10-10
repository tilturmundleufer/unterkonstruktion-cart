// Next.js API route for Foxy Custom Tax Endpoint
export default async function handler(req, res) {
  try {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

    let data = req.method === 'GET' ? req.query : req.body;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch (_) {} }
    if (data?.input && typeof data.input === 'string') { try { data = JSON.parse(data.input); } catch (_) {} }
    if (data?.cart && typeof data.cart === 'string') { try { data = JSON.parse(data.cart); } catch (_) {} }


    // Werte robust lesen (können als String kommen)
    const num = (v) => {
      const n = typeof v === 'string' ? parseFloat(v) : Number(v);
      return isFinite(n) ? n : 0;
    };
    const s = (v) => (v == null ? '' : String(v));

    // Entscheide Steuer-Satz (vereinfachte Logik): Firma => 19%, sonst 0%
    const company = s(data?.billing_company || data?.shipping_company || '')
      || s(data?._embedded?.['fx:billing_address']?.company || data?._embedded?.['fx:shipping_address']?.company || data?._embedded?.['fx:shipment']?.company || '');
    const customerType = s(data?.customer_type || data?.fields?.customer_type || '').toLowerCase();
    const isBusiness = company.trim().length > 0 || ['business','firma','firmenkunde'].includes(customerType);
    const tax_rate = isBusiness ? 0.19 : 0;

    // Steuerbasis (wie Foxy-Beispiel): Items + Shipping + Discount
    const total_item_price   = num(data?.total_item_price);
    const total_shipping     = num(data?.total_shipping);
    const total_discount     = num(data?.total_discount);
    const base = total_item_price + total_shipping + total_discount; // discount ggf. negativ

    const tax_amount = tax_rate * base;
    const response = {
      ok: true,
      details: '',
      name: 'custom tax',
      expand_taxes: [
        { name: 'MwSt', rate: tax_rate, amount: tax_amount }
      ],
      total_amount: tax_amount,
      total_rate: tax_rate
    };

    return res.status(200).json(response);
  } catch (e) {
    return res.status(200).json({ taxes: [] });
  }
}

export const config = { api: { bodyParser: true } };