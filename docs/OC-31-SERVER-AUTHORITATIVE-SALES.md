# OC-31 — Server-Authoritative Sales Ledger & Recovery

## Goal

Completed ORBI POS sales are no longer authoritative browser-local state.

OC-31 makes the trusted-LAN ORBI server the source of truth for completed sales.

~~~text
cart
  ↓
payment / method validation
  ↓
POST /sales
  ↓
server validation
  ↓
sales.json persisted
  ↓
server acknowledgement
  ↓
cart closes
~~~

If server persistence does not complete, the cart remains open.

## Server file

~~~text
stores/<storeId>/sales.json
~~~

The file contains immutable completed-sale snapshots.

There is no sale update or DELETE endpoint in OC-31.

## Sale record

Each sale records:

- ORBI sale ID;
- store ID;
- stable browser client request ID;
- sale creation timestamp;
- server recorded timestamp;
- source;
- complete line snapshot;
- payment method;
- integer CLP total;
- optional Payment Core trace;
- creation audit event.

Example shape:

~~~json
{
  "id": "SALE-20260925-abcdef123456",
  "storeId": "el-chunchito",
  "clientRequestId": "sale_...",
  "createdAt": "...",
  "recordedAt": "...",
  "source": "orbi-pos-web",
  "lines": [],
  "paymentMethod": "cash",
  "total": 5610,
  "audit": [
    {
      "event": "created",
      "actor": "orbi-pos-web",
      "detail": "server_authoritative"
    }
  ]
}
~~~

## Server-side money validation

The browser does not decide whether a completed sale is valid.

The server checks every line:

- line ID;
- product ID;
- non-empty product name;
- unit type;
- finite positive quantity;
- integer unit price;
- integer subtotal;
- duplicate line IDs;
- expected CLP-10 subtotal rounding.

For the current RM-60-compatible pilot rule:

~~~text
round((unitPrice × quantity) / 10) × 10
~~~

The sale total must equal the exact sum of validated line subtotals.

## Card-sale linkage

Debit/credit sales require an existing Payment Core order.

The referenced order must currently be:

~~~text
processed
~~~

At sale creation time the server checks:

- ORBI payment order ID;
- provider;
- provider order ID;
- external reference;
- terminal ID;
- requested card method;
- amount.

A card sale cannot be completed if the Payment Core amount or trace does not match.

One Payment Core order cannot back two separate sales.

## Cash / transfer

Cash and transfer sales do not carry provider payment evidence.

If a cash/transfer request contains a Point/Mercado Pago trace, the server rejects it.

OC-31 does not infer whether physical cash was handed over or a bank transfer arrived. It records the operator-selected method only.

## Idempotency

The browser creates one stable:

~~~text
clientRequestId
~~~

per current sale.

If the HTTP response is lost after the server already persisted the sale, the browser can retry with the same ID.

The server returns the existing sale rather than duplicating it.

If the same client request ID is reused with different lines/amount/payment data, ORBI rejects it as an idempotency conflict.

This prevents a changed cart from being silently mapped to an earlier completed sale.

## Point approved but sale persistence fails

This is treated differently from a declined payment.

When Payment Core reaches:

~~~text
processed
~~~

but `POST /sales` fails, the Point dialog remains open and shows:

~~~text
PAYMENT PROCESSED
SALE NOT YET CONFIRMED
DO NOT CHARGE AGAIN
~~~

The operator can retry only the sale-registration step.

The retry is idempotent and keeps the same Payment Core order.

The cart is not cleared until the server confirms the sale record.

## Sales UI

The main ORBI navigation now includes:

~~~text
Ventas
~~~

Direct view:

~~~text
/?view=sales
~~~

The screen shows:

- sales today;
- total today;
- recent server-authoritative sales;
- payment method;
- line count;
- Point trace for card sales;
- server status.

## Legacy browser-only sales

Previous pilot versions used:

~~~text
orbi-pos:pilot-sales
~~~

in browser localStorage.

OC-31 does not auto-import these records.

The Sales Ledger detects them and offers a JSON export for manual review.

This is deliberate: old browser records are not silently promoted into authoritative operational evidence.

## API

~~~text
GET  /api/stores/:storeId/sales
GET  /api/stores/:storeId/sales/:saleId
POST /api/stores/:storeId/sales
~~~

No PUT/PATCH/DELETE sale endpoint exists.

## Disaster recovery

OC-29 now includes:

~~~text
sales.json
~~~

as an allowlisted file and protected restore target.

A full server archive therefore protects:

- catalog;
- Payment Core audit;
- authoritative sales;
- RM-60 fleet;
- product assets;
- OC-27 evidence;
- OC-28 browser-state backups.

## Recovery certification

OC-30 now reconstructs and validates `sales.json` in its isolated sandbox.

Checks include:

- JSON sales array;
- store ID;
- sale ID/client request identity;
- line presence;
- line subtotals;
- total sum;
- payment method;
- card trace structure;
- SaleStore reopen/count.

The drill performs no provider call.

## Fiscal boundary

A server-authoritative ORBI sale is not an SII document.

OC-31 does not:

- issue a boleta;
- issue a factura;
- send a DTE;
- replace Inputsoft/SUNMI fiscal handling;
- declare a sale to SII.

Fiscal migration remains a separate controlled decision.

## RM-60 boundary

OC-31 records sales only.

It does not:

- read live weight from an RM-60;
- change a PLU;
- change a scale price;
- synchronize the four scales.

## Operating principle

~~~text
payment confirmed
      +
sale persisted
      =
cart may close
~~~

For card transactions:

~~~text
Point processed
      but
sales.json not confirmed
      =
DO NOT CHARGE AGAIN
RETRY SALE PERSISTENCE
~~~
