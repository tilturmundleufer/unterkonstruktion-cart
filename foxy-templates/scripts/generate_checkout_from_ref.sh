#!/usr/bin/env bash
set -euo pipefail

REF="./templates/_ref.checkout.inc.twig"
OUT="./templates/checkout.inc.twig"

if [[ ! -f "$REF" ]]; then
  echo "❌ $REF not found. Run scripts/pull_foxy_defaults.sh first."
  exit 1
fi

cat > "$OUT" <<'TWIG'
{# checkout.inc.twig — custom wrapper version
   NOTE: We keep Foxy's Twig logic intact. We only add brand wrappers/classes.
         Attach CSS via Webflow or styles/checkout-overrides.css.
#}

<div class="ukc-checkout" data-ukc="checkout">
  <div class="ukc-checkout__container">
    <div class="ukc-checkout__grid">
TWIG

cat "$REF" >> "$OUT"

cat >> "$OUT" <<'TWIG'
    </div>
  </div>
</div>
TWIG

echo "✅ Generated $OUT based on $REF with brand wrappers."



