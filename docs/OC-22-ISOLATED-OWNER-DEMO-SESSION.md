# OC-22 — Isolated Owner Demo Session

## Goal

Provide a complete end-to-end ORBI sales demonstration for the owner without touching any real pilot state.

## Route

~~~text
/piloto/sesion
~~~

The route is launched from the owner pilot hub with **Iniciar demo completa**.

## Demo flow

~~~text
Demo catalog
    |
    v
Choose product
    |
    v
Enter weight / quantity
    |
    v
Demo cart
    |
    v
Choose debit / credit
    |
    v
Local Point Smart 2 simulator
    |
    +--> rejected / canceled / expired
    |
    +--> processed
           |
           v
      Demo receipt
~~~

## Isolation boundary

The session intentionally does not use any operational persistence or backend payment service.

It does **not**:

- call catalog sync;
- publish catalog changes;
- call Payment Core;
- create backend mock payment orders;
- write to the real sales localStorage key;
- update RM-60/PLU data;
- update discovery;
- update proposal assumptions;
- call Mercado Pago;
- emit SII documents.

All cart, payment and result state exists only in React memory for the current page lifetime.

Reloading or leaving the page destroys the demo transaction.

## Demo catalog

The session uses the existing isolated `demoProducts` catalog.

Every accepted demo product must:

- have an id starting with `demo-`;
- have a customer-facing code starting with `D`;
- not be marked as verified pilot data.

Real catalog products are rejected by the demo-line constructor.

## Payment state machine

The local simulator uses:

~~~text
idle
  |
  v
created
  |
  +--> canceled
  +--> expired
  |
  v
at_terminal
  |
  +--> processed
  +--> failed
  +--> canceled
  +--> expired
~~~

A demo receipt can be generated only from `processed`.

The simulator deliberately does not call the OC-13 backend mock provider because backend mock orders are part of the Payment Core audit store. OC-22 must leave that store untouched.

## Owner presentation

The UI keeps **DEMO AISLADA** visible throughout the session and states:

- no real catalog;
- no persistent sale;
- no Payment Core order;
- no money movement;
- no SII boleta.

This makes it safe to repeat the owner walkthrough as many times as needed.

## Reset

**Reiniciar sesión** clears:

- selected scenario;
- cart;
- payment state;
- reference;
- demo result.

No cleanup request is required because nothing was persisted.

## Tests

Pure tests certify:

- only demo catalog products can enter the session;
- POS subtotal rounding is reused;
- created cannot jump directly to processed;
- receipt generation requires processed;
- references are unmistakably prefixed with `DEMO-`.
