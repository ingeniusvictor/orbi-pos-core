# ORBI POS Core

ORBI POS Core is the retail point-of-sale foundation for small businesses.

The first pilot is **ORBI POS — El Chunchito**, focused on proving that a modern, visual and easy-to-use sales interface can improve day-to-day counter operations before adding more advanced modules.

## Pilot goals

The v0.1 pilot is intentionally small:

- visual product categories;
- product cards with price and unit;
- weight / quantity entry;
- cart and automatic totals;
- payment method selection;
- completed-sale history;
- simple daily sales summary.

Not included in the first pilot:

- SII / DTE issuance;
- DIGI RM-60 automatic integration;
- inventory management;
- supplier management;
- AI features;
- public ecommerce website.

Those remain possible later modules only after the pilot proves useful to real users.

## Technical direction

- React + Vite + TypeScript
- touch-first responsive UI
- local-first demo workflow
- modular domain model designed to grow into inventory, suppliers, scale integration and Chilean tax integrations later

## Reference repositories

We are studying existing POS and meat-business projects for product ideas and architecture patterns. Third-party source code must **not** be copied into this repository unless its license explicitly permits reuse and the required attribution/terms are documented.

In particular, `FaustinoDuran/carniceria-pos` is currently treated as an architectural/reference study because no repository-level reuse license has been confirmed.

## Pilot

**Business:** Carnicería El Chunchito  
**Product:** ORBI POS  
**Status:** Foundation
