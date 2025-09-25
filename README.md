# Foxy Templates (Unterkonstruktion)

## Brand Tokens (HEX)
- --brand-blue: `#072544`
- --brand-yellow: `#ffb101`
- --brand-yellow-soft: `#fffdfa`

## 1) Pull official Foxy defaults
```bash
bash scripts/pull_foxy_defaults.sh
```

## 2) Generate our custom cart include
```bash
bash scripts/generate_cart_from_ref.sh
```

This produces templates/cart.inc.twig wrapped in .ukc-cart etc.

## 3) Use in Webflow

Create 3 pages in Webflow: Cart, Checkout, Receipt. Between your navbar & footer, place `<div id="fc"></div>`. Publish on your domain.

## 4) Wire up in Foxy (Admin)
- Set Checkout Template URL → your Webflow checkout page (e.g. /checkout)
- Set Cart Template URL → your Webflow cart page (e.g. /cart)
- Set Receipt Template URL → your Webflow receipt page (e.g. /order-received)
- For each template, click Cache in Foxy admin.

## 5) Override Cart Include (the inner markup)

Host templates/cart.inc.twig at a public URL (e.g. https://unterkonstruktion.de/foxy/cart.inc.twig or Vercel/S3).
In Foxy admin: Cart Include Template → content_url = that URL → Cache.

## 6) Styling

Copy styles/foxy-overrides.css into Webflow (Site Settings → Custom Code → Head) or serve it as an external CSS file. Adjust brand tokens to exact HEX.

### Webflow Einbindung
- Global: Webflow Site Settings → Custom Code → Head → Inhalt von `styles/foxy-overrides.css` einfügen.
- Alternativ: Per-Page Custom Code (Head) auf den Seiten Cart/Checkout/Receipt.

### B2B/B2C Hook (nur CSS-States, keine Logikänderung)
Fügen Sie diesen Snippet in Webflow (Page Footer Custom Code) ein, um `localStorage(solarTool_customerType)` als Klassen am `<html>`-Element zu spiegeln:

```html
<script>
(function(){
  try{
    var t=localStorage.getItem('solarTool_customerType')||'private';
    document.documentElement.classList.toggle('is-business', t==='business');
    document.documentElement.classList.toggle('is-private', t!=='business');
  }catch(e){}
})();
</script>
```

Beispiel-CSS für optionale Felder:

```css
.is-private .ukc-only-business{display:none !important}
.is-business .ukc-only-private{display:none !important}
```

## Foxy Admin Schritte
1. Setzen Sie die Template-URLs auf Ihre Webflow-Seiten und cachen Sie jede:
   - Checkout Template URL → `https://unterkonstruktion.de/checkout`
   - Cart Template URL → `https://unterkonstruktion.de/cart`
   - Receipt Template URL → `https://unterkonstruktion.de/order-received`
   - Danach jeweils: Cache
2. Hosten Sie `templates/cart.inc.twig` öffentlich (z.B. `https://unterkonstruktion.de/foxy/cart.inc.twig`).
   - In Foxy Admin: Cart Include Template → `content_url` = diese URL → Cache.

### cURL (optional statt UI)
```bash
# Set Webflow pages as template URLs + build cache
curl -X PATCH "https://api.foxycart.com/checkout_templates/{id}" \
  -H "Authorization: Bearer YOUR_TOKEN" -H "FOXY-API-VERSION: 1" -H "Content-Type: application/json" \
  -d '{"content_url":"https://unterkonstruktion.de/checkout"}'
curl -X POST  "https://api.foxycart.com/checkout_templates/{id}/cache" \
  -H "Authorization: Bearer YOUR_TOKEN" -H "FOXY-API-VERSION: 1"

curl -X PATCH "https://api.foxycart.com/cart_templates/{id}" \
  -H "Authorization: Bearer YOUR_TOKEN" -H "FOXY-API-VERSION: 1" -H "Content-Type: application/json" \
  -d '{"content_url":"https://unterkonstruktion.de/cart"}'
curl -X POST  "https://api.foxycart.com/cart_templates/{id}/cache" \
  -H "Authorization: Bearer YOUR_TOKEN" -H "FOXY-API-VERSION: 1"

curl -X PATCH "https://api.foxycart.com/receipt_templates/{id}" \
  -H "Authorization: Bearer YOUR_TOKEN" -H "FOXY-API-VERSION: 1" -H "Content-Type: application/json" \
  -d '{"content_url":"https://unterkonstruktion.de/order-received"}'
curl -X POST  "https://api.foxycart.com/receipt_templates/{id}/cache" \
  -H "Authorization: Bearer YOUR_TOKEN" -H "FOXY-API-VERSION: 1"

# Set our Cart Include (inner markup) + build cache
curl -X PATCH "https://api.foxycart.com/cart_include_templates/{id}" \
  -H "Authorization: Bearer YOUR_TOKEN" -H "FOXY-API-VERSION: 1" -H "Content-Type: application/json" \
  -d '{"content_url":"https://unterkonstruktion.de/foxy/cart.inc.twig"}'
curl -X POST  "https://api.foxycart.com/cart_include_templates/{id}/cache" \
  -H "Authorization: Bearer YOUR_TOKEN" -H "FOXY-API-VERSION: 1"
```

### Warum sehe ich keine Änderung?
- Nach jeder Änderung: Cache im Foxy Admin neu aufbauen
- Prüfen, dass `content_url` öffentlich erreichbar ist (Status 200, CORS ok)
- Browser-Cache leeren/Hard-Reload

### Technische Hinweise
- **Sidebar-Wrapper**: Die Klasse `ukc-summary` wird direkt an `.fc-sidebar--cart` angehängt, um Foxy's Grid-Assumptions nicht zu brechen.
- **Sticky Summary**: Auf Desktop (≥961px) wird die Summary sticky positioniert. Zum Deaktivieren: `.ukc-summary { position: static !important; }` in Webflow Custom Code hinzufügen.
