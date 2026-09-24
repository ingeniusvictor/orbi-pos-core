# OC-12 — Shared Price Audit Across Admin Devices

## Goal

Make price history as shared as the catalog itself.

Before OC-12, the product catalog synchronized across admin devices and the wall TV, but price-history entries were stored only in each browser.

OC-12 moves the authoritative audit to the LAN sync server.

## Server-authoritative behavior

Every accepted catalog revision is compared against the previous server snapshot.

For every existing product whose price changed, the server appends:

~~~text
product id
product name
previous price
next price
server timestamp
~~~

The history is stored inside the same persistent catalog snapshot and is capped to the latest 1,000 entries for the pilot.

## What does not create price history

These operations do not create audit entries when the price is unchanged:

- product name edit;
- customer-code edit;
- category edit;
- PLU mapping;
- Showcase visibility/order;
- image assignment;
- promotional text.

Adding a brand-new product establishes its initial price but is not treated as a price change.

## Multi-device behavior

When a synchronized admin receives a catalog snapshot, it also receives the shared price audit.

~~~text
Admin A changes Pernil
        |
        v
ORBI server records 4.898 -> 5.190
        |
        +------> Admin A history
        |
        +------> Admin B history
~~~

The same shared history powers the guarded rollback added in OC-10.

## Rollback

A rollback is simply another catalog revision with prices restored.

The server detects those reverse price changes and appends them as new audit entries.

History remains append-only.

## Local fallback

When no sync server is available, the existing browser-local price history continues to work.

Once connected to a shared ORBI server, the server history becomes authoritative.

## Upgrade behavior

Older catalog.json files that do not contain priceHistory are read safely as an empty shared history. The first later price change begins the server audit.
