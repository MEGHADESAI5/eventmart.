#!/usr/bin/env bash
# End-to-end demo against a running `docker compose up`.
set -euo pipefail
URL=${URL:-http://localhost:4000/}
gql() { curl -s "$URL" -H 'content-type: application/json' -d "$1"; echo; }

echo "== Products (GraphQL -> gRPC -> inventory-service)"
gql '{"query":"{ products { sku name stock unitPriceCents } }"}'

echo "== Place an order (PENDING, then confirmed asynchronously via Kafka)"
gql '{"query":"mutation { placeOrder(input:{customerId:\"megha\", items:[{sku:\"KB-001\", quantity:2}]}) { id status totalCents } }"}'

sleep 3
echo "== Orders after the event flow finished (expect CONFIRMED)"
gql '{"query":"{ orders(customerId:\"megha\") { id status totalCents reason } }"}'

echo "== Out-of-stock order is rejected up front (gRPC CheckStock)"
gql '{"query":"mutation { placeOrder(input:{customerId:\"megha\", items:[{sku:\"MN-003\", quantity:99}]}) { id } }"}'
