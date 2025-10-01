#!/usr/bin/env bash
set -euo pipefail

REF="./templates/_ref.cart.inc.twig"
OUT="./templates/cart.inc.twig"

if [[ ! -f "$REF" ]]; then
  echo "❌ $REF not found. Run scripts/pull_foxy_defaults.sh first."
  exit 1
fi

cat > "$OUT" <<'TWIG'
// cart.inc.twig — custom wrapper version
// NOTE: We keep Foxy's Twig logic intact. We only add brand wrappers/classes.
//       You can attach your CSS in Webflow or styles/foxy-overrides.css.

<div class="ukc-cart" data-ukc="cart">
  <div class="ukc-cart__container">
    <div class="ukc-cart__grid">
TWIG

# Insert the original file verbatim
cat "$REF" >> "$OUT"

cat >> "$OUT" <<'TWIG'
    </div>
  </div>
</div>
TWIG

echo "✅ Generated $OUT based on $REF with brand wrappers."

