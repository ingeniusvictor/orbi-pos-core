# OC-15 — Card Checkout State Machine

## Goal

Prevent ORBI from recording a card sale as paid before the payment provider confirms success.

## Previous pilot behavior

The early POS proof immediately completed every sale when **Cobrar** was pressed.

That is acceptable for UI prototyping but unsafe for an integrated card terminal.

## Current behavior

Cash and transfer remain local/manual pilot methods.

Debit and credit use the payment workflow:

~~~text
Cart
  |
  v
Create ORBI payment order
  |
  v
created
  |
  v
at_terminal
  |
  +---- processed ----> persist completed sale
  |
  +---- failed --------> cart remains open
  |
  +---- canceled ------> cart remains open
  |
  +---- expired -------> cart remains open
~~~

The completed Sale keeps:

- ORBI payment-order id;
- provider order id;
- external reference;
- terminal id;
- provider name.

## Mock Point demo

When the active provider is `mock`, the checkout modal exposes demonstration controls:

- terminal received order;
- approve payment;
- reject;
- expire.

This allows the owner-facing demo to show the same state machine that will later be driven by Point Smart 2.

No real payment is created in mock mode.

## External reference

An example ORBI reference:

~~~text
ORBI-20260924-a1b2c3d4e5f6
~~~

It contains no customer PII and is suitable for correlating the ORBI sale with the provider order.

## Production boundary

A real Mercado Pago adapter is present but remains inactive until:

1. the business decides to pilot Point;
2. a real Mercado Pago application/credential is available;
3. the physical terminal is associated;
4. its real terminal id is known;
5. PDV mode is verified;
6. the existing SUNMI/Inputsoft/SII situation is reconciled.

The existing fiscal workflow is not replaced by this milestone.
