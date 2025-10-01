#!/usr/bin/env bash
set -euo pipefail

REF="./templates/_ref.receipt.inc.twig"
OUT="./templates/receipt.inc.twig"

if [[ ! -f "$REF" ]]; then
  echo "❌ $REF not found. Run scripts/pull_foxy_defaults.sh first."
  exit 1
fi

cat > "$OUT" <<'TWIG'
{# receipt.inc.twig — custom wrapper version
   NOTE: We keep Foxy's Twig logic intact. We only add brand wrappers/classes.
         Attach CSS via Webflow or styles/checkout-overrides.css.
#}

<div class="ukc-receipt" data-ukc="receipt">
  <div class="ukc-receipt__container">
    <div class="ukc-receipt__grid">
TWIG

cat "$REF" >> "$OUT"

cat >> "$OUT" <<'TWIG'
    </div>
  </div>
</div>
TWIG

echo "✅ Generated $OUT based on $REF with brand wrappers."



