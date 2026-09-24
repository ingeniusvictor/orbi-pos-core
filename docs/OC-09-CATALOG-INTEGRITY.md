# OC-09 — Master Catalog Integrity & Easy Product Editing

## Goal

Prepare the product master for the real El Chunchito catalog without turning routine corrections into a technical task.

## Responsibility split

ORBI keeps the common workflows intentionally separate:

- **Productos** — customer-facing code, name, category and sale unit;
- **Precios** — rapid day-to-day price changes;
- **Balanza** — RM-60 PLU discovery and mapping;
- **Showcase** — presentation, images, ordering and promotional text.

This reduces the risk of changing unrelated data while performing a frequent task.

## Product creation integrity

Before a product is added, the web app validates:

- customer code: 1–12 characters, letters/numbers/hyphen;
- non-empty product name;
- valid category;
- positive integer CLP price;
- KG / UNIT / PACK sale unit;
- optional PLU: 1–6 digits;
- customer code uniqueness;
- PLU uniqueness when present.

Customer codes are normalized to uppercase.

## Product editing

The Products screen now includes search by:

- product name;
- customer-facing code;
- PLU.

An existing product can be edited without recreating it. Editable identity fields are:

- customer-facing code;
- product name;
- category;
- sale unit.

The internal product id remains stable, so editing these fields does not detach price, image, Showcase metadata or PLU.

Products are deactivated/reactivated rather than destructively deleted.

## Server boundary

The shared catalog server independently validates the final payload.

It rejects:

- malformed customer codes;
- invalid PLUs;
- duplicate product ids;
- duplicate customer codes;
- duplicate PLUs;
- invalid prices;
- invalid sale units;
- invalid sort order;
- malformed boolean flags.

The browser validation is for usability; the server remains the final integrity boundary.

## Why price and PLU are not in the general editor

Price changes are expected to happen frequently and already have a dedicated fast interface plus price history.

RM-60 PLUs require field evidence and are managed in the dedicated Balanza workspace.

Keeping these separate is deliberate, not a missing feature.
