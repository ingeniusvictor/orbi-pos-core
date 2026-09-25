# OC-34 — Cash Drawer Sessions & Physical Count Reconciliation

## Goal

OC-34 adds the physical-cash layer intentionally excluded from OC-33.

The server remains authoritative for completed sales. The operator remains authoritative
for the amount of cash physically counted in the drawer.

## Persistent file

~~~text
stores/<storeId>/cash-drawer.json
~~~

Sessions are append-only operational records. Movements are append-only and there is
no edit/delete endpoint.

## Session rules

- only one drawer session can be open per store;
- opening float is an integer CLP amount;
- business date uses the configured IANA business timezone;
- default timezone remains `America/Santiago`;
- cash sales are selected from `SaleStore` using authoritative `recordedAt`;
- normal POS checkout is not blocked when no drawer session is open.

## Manual cash movements

Supported movement types:

~~~text
paid_in
paid_out
~~~

Each movement stores an immutable ID, amount, reason and timestamp.

## Expected cash

~~~text
expectedCash =
  openingFloat
  + cashSales
  + paidIn
  - paidOut
~~~

At close the operator enters `countedCash`.

~~~text
variance = countedCash - expectedCash
~~~

A repeated close with the same physical count returns the already-closed session.
A retry with a different physical count is rejected.

## API

~~~text
GET  /api/stores/:storeId/cash-drawer
GET  /api/stores/:storeId/cash-drawer/active
POST /api/stores/:storeId/cash-drawer/open
GET  /api/stores/:storeId/cash-drawer/:sessionId/preview
POST /api/stores/:storeId/cash-drawer/:sessionId/movements
POST /api/stores/:storeId/cash-drawer/:sessionId/close
~~~

No provider call is required by these endpoints.

## UI

The main navigation includes:

~~~text
/?view=cash
~~~

The Caja workspace shows:

- current open/closed state;
- opening float;
- live cash-sale count/total;
- paid-in and paid-out totals;
- expected cash;
- movement entry;
- physical count entry;
- final variance;
- immutable session history.

## Disaster recovery

OC-29 includes `cash-drawer.json` in the exact-file allowlist and protected restore
targets.

OC-30 reconstructs the file into the isolated recovery sandbox and validates:

- session/store identities;
- maximum one open session;
- movement identity/type/amount/reason;
- paid-in/out sums;
- cash-sales snapshot;
- expected-cash equation;
- counted cash and variance;
- source fingerprint;
- successful reopen through `CashDrawerStore`.

The drill performs no provider call.

## Safety boundary

OC-34 is not:

- a cash sensor;
- a bank reconciliation;
- a card settlement reconciliation;
- an SII/tax close;
- an automatic money movement;
- a DIGI RM-60 integration.

The physical count is entered by the operator.
