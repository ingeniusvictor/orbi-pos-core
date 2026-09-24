# OC-02 — Master Catalog, Quick Pricing & Showcase Foundation

## Objective

Move ORBI POS from a hard-coded demo toward a small but complete operating core for Carnicería El Chunchito.

The key principle is:

> The price exists once in the master catalog and every ORBI surface reads from that source.

## Master catalog

Each product now carries:

- customer-facing code;
- optional RM-60 PLU;
- name;
- category;
- price;
- unit type: KG / UNIT / PACK;
- active state;
- Showcase visibility;
- featured flag;
- display order;
- optional image URL.

The existing RM-60 PLU table has not yet been confirmed, so the current customer codes 101 and 102 are provisional ORBI display codes.

## Quick Price Board

A dedicated **Precios** screen supports:

- search by name, customer code or PLU;
- category filtering;
- direct inline price editing;
- quick -100 / +100 adjustments;
- bulk percentage adjustment for visible products;
- one save action for multiple changes;
- persistent price history containing old price, new price and timestamp.

This is deliberately separate from the full product editor because price changes are expected to be a frequent daily operation.

## Showcase foundation

A new Showcase surface reads directly from the same master catalog.

Route:

`/showcase`

The current implementation provides:

- 16:9 premium TV layout;
- featured hero product;
- up to six visible products;
- large customer-facing codes;
- large prices;
- full-screen browser mode;
- automatic empty slots until the real El Chunchito catalog is loaded.

No unverified El Chunchito products or prices are seeded. Only the two prices visible in the supplied RM-60 receipt remain preloaded.

## Local-first limitation

For this pilot, catalog and price data persist in browser local storage.

That is enough for demonstration and UX testing, but a TV opened on another device will not yet receive changes from the administration device.

Cross-device synchronization will require a small shared backend/database in a later milestone.

## RM-60 boundary

OC-02 does not write prices or PLUs to the DIGI RM-60.

The catalog model is prepared for this future relationship:

`customer code -> product -> PLU -> price`

The next hardware research step is to recover the real PLU configuration and determine the safest supported communication path.

## Acceptance target

OC-02 is ready for pilot review when:

- products can be added without editing source code;
- price changes persist;
- price history is preserved;
- sales use the current master price;
- Showcase uses the current master price;
- tests and build are green.
