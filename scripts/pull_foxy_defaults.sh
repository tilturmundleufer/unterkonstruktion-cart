#!/usr/bin/env bash
set -euo pipefail

BASE="https://raw.githubusercontent.com/FoxyCart/2.0-templates/master"

mkdir -p "./templates"

curl -fsSL "$BASE/cart.inc.twig"     -o "./templates/_ref.cart.inc.twig"
curl -fsSL "$BASE/checkout.inc.twig" -o "./templates/_ref.checkout.inc.twig"
curl -fsSL "$BASE/receipt.inc.twig"  -o "./templates/_ref.receipt.inc.twig"
curl -fsSL "$BASE/utils.inc.twig"    -o "./templates/_ref.utils.inc.twig"

echo "✅ Pulled Foxy default templates into ./templates/_ref.*"

