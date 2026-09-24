# ORBI POS Core

ORBI POS Core is the retail point-of-sale foundation for small businesses.

The first pilot is **ORBI POS — El Chunchito**, focused on proving that a modern, visual and easy-to-use sales experience can improve day-to-day counter operations before adding more advanced modules.

## Current pilot

The current working slice includes:

- visual product categories;
- master product catalog with safe metadata editing and search;
- validated unique customer-facing product codes;
- optional DIGI RM-60 PLU mapping field;
- fast price editing, append-only price history and guarded one-step rollback;
- full-screen `/showcase` TV surface;
- rotating Showcase hero/product-board presentation engine;
- Showcase content controls for TV visibility, featured products, order and promo text;
- shared JPG/PNG/WebP product-image library served to POS and TV;
- safe catalog CSV import/export with preview;
- unattended TV kiosk controls, automatic recovery cues and admin diagnostics;
- shared LAN catalog synchronization for a separate TV/browser;
- local cache/fallback when the sync server is unavailable;
- weight entry and RM-60-compatible CLP 10 subtotal rounding;
- cart, payment-method selection and local completed-sale persistence;
- simple daily sales summary.

Only the two prices verified from the supplied El Chunchito RM-60 receipt are preloaded.

Still deliberately excluded:

- SII / DTE issuance;
- automatic DIGI RM-60 writes;
- inventory management;
- supplier management;
- employee permissions;
- public ecommerce;
- AI features.

## Development

Requirements: Node.js 20+ and npm.

Install:

```bash
npm install
```

Run the shared catalog server in one terminal:

```bash
npm run dev:sync
```

Run the web app in another:

```bash
npm run dev:web
```

Vite proxies `/api` to the local sync server.

## Single-process LAN pilot

Build both workspaces:

```bash
npm test
npm run build
```

Then start ORBI POS:

```bash
npm start
```

The server listens on port `8787` by default and serves both the API and the built web application.

On another device in the same local network, open:

```text
http://HOST-LAN-IP:8787/
http://HOST-LAN-IP:8787/showcase
```

The exact host IP depends on the local network.

## Technical direction

- React + Vite + TypeScript
- Node + Express LAN sync service
- touch-first responsive UI
- TV-first 16:9 Showcase
- local cache plus shared catalog revisions
- modular domain model prepared for inventory, suppliers, RM-60 integration and Chilean tax integrations later

## Security boundary

The OC-03 synchronization service is intended for a trusted local-network pilot. It has no owner authentication yet and must not be exposed directly to the public internet.

## Reference repositories

We are studying existing POS and meat-business projects for product ideas and architecture patterns. Third-party source code must **not** be copied into this repository unless its license explicitly permits reuse and the required attribution/terms are documented.

In particular, `FaustinoDuran/carniceria-pos` is currently treated as an architectural/reference study because no repository-level reuse license has been confirmed.

## Pilot

**Business:** Carnicería El Chunchito  
**Product:** ORBI POS + ORBI Showcase  
**Milestone:** OC-10 Price Change Safety


## TV pilot on Windows

For a Windows mini-PC connected to the display, OC-08 includes a one-command pilot launcher:

~~~powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\start-tv-pilot.ps1
~~~

The admin interface also includes an **Estado** section for checking catalog synchronization, image-library availability, Showcase readiness and RM-60 PLU mapping progress.
