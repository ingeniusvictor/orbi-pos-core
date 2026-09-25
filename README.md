# ORBI POS Core

ORBI POS Core is the retail point-of-sale foundation for small businesses.

The first pilot is **ORBI POS — El Chunchito**, focused on proving that a modern, visual and easy-to-use sales experience can improve day-to-day counter operations before adding more advanced modules.

## Current pilot

The current working slice includes:

- visual product categories;
- master product catalog with safe metadata editing and search;
- validated unique customer-facing product codes;
- four-device DIGI RM-60 fleet registry plus product PLU mapping;
- fast price editing, shared append-only price audit and guarded one-step rollback;
- full-screen `/showcase` TV surface;
- isolated `/showcase-demo` presentation route with permanently marked illustrative data;
- rotating Showcase hero/product-board presentation engine;
- Showcase content controls for TV visibility, featured products, order and promo text;
- shared JPG/PNG/WebP product-image library served to POS and TV;
- safe catalog CSV import/export with preview;
- unattended TV kiosk controls, automatic recovery cues and admin diagnostics;
- shared LAN catalog synchronization for a separate TV/browser;
- local cache/fallback when the sync server is unavailable;
- weight entry and RM-60-compatible CLP 10 subtotal rounding;
- cart, payment-method selection and local completed-sale persistence;
- backend Payment Core with mock Point Smart 2 simulator;
- dormant Mercado Pago Point Orders adapter with backend-only credentials;
- terminal/provider registry and payment operations center;
- Point Webhook HMAC verifier + authoritative provider-order reconciliation;
- `action_required` safety state requiring terminal review;
- card checkout state machine that only closes sales after payment status `processed`;
- owner-facing modernization proposal with evidence-aware cost-benefit calculator;
- structured field discovery for SUNMI/Inputsoft/SII, current costs and the four RM-60 scales;
- dynamic question pack for Diana plus sanitized discovery JSON export;
- Discovery → Proposal bridge that reuses verified current costs/fees without overwriting manual corrections;
- owner-facing `/piloto` demo hub with guided navigation and separate software-vs-field readiness;
- fully isolated `/piloto/sesion` end-to-end owner demo that never writes operational sales/payment data;
- printable `/piloto/resumen` owner summary with readiness, economics and blockers;
- `/piloto/decision` production decision gate that blocks migration until technical, fiscal, commercial, Point and rollback evidence is recorded;
- direct `?view=` links for opening specific admin workspaces;
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
**Milestone:** OC-24 Production Decision Gate


## TV pilot on Windows

For a Windows mini-PC connected to the display, OC-08 includes a one-command pilot launcher:

~~~powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\start-tv-pilot.ps1
~~~

The admin interface also includes an **Estado** section for checking catalog synchronization, image-library availability, Showcase readiness and RM-60 PLU mapping progress.


## Visual demo

Until the real El Chunchito catalog is available, the owner-facing concept can be shown at:

~~~text
http://HOST:8787/showcase-demo
~~~

That route uses isolated illustrative products/prices and is permanently marked as DEMO. It never publishes those examples into the real master catalog.


## Point / Mercado Pago readiness

Development defaults to a no-money simulator:

~~~text
ORBI_PAYMENT_PROVIDER=mock
~~~

The simulated Point flow lets ORBI demonstrate create -> terminal -> approved/failed without a physical terminal.

The real Mercado Pago adapter is server-side only and remains inactive until the business has a real application credential and Point terminal:

~~~text
ORBI_PAYMENT_PROVIDER=mercadopago
MERCADO_PAGO_ACCESS_TOKEN=<server secret>
ORBI_POINT_TERMINAL_ID=<real terminal id>
ORBI_POINT_STORE_ID=<real store id>
ORBI_POINT_POS_ID=<real POS/cashbox id>
~~~

Never expose the Mercado Pago Access Token through Vite/browser environment variables.

A real card sale is not persisted as paid until the provider order reaches `processed`.


## RM-60 fleet discovery

The current shop topology is represented as four DIGI RM-60 units. RM60-01 is marked as the staff-described principal scale and as the current price-administration source.

The relationship between the four devices remains explicitly **unverified** until field observation confirms whether RM60-01 distributes catalog/price changes or whether the scales maintain independent data.

No ORBI command is sent to the scales by OC-17.


## Payment webhook boundary

The local ORBI server is not a public Mercado Pago Webhook target.

OC-16 prepares a public-relay architecture and includes Mercado Pago HMAC verification plus authoritative order reconciliation. A future public relay must validate the webhook and persist/deduplicate the event, while the shop ORBI confirms the final state using Mercado Pago `GET /v1/orders/{id}` before treating a card sale as paid.

The `action_required` Point state is treated as manual attention: ORBI does not close the sale automatically.


## Owner modernization proposal

The admin interface includes **Propuesta**, and a standalone meeting view is available at:

~~~text
http://HOST:8787/modernizacion
~~~

The comparison separates confirmed shop facts, pending discovery and the target ORBI + Point architecture.

The cost-benefit calculator starts with blank business inputs. It does not claim savings until real current costs, card volume/fees and a current proposal quotation are entered. Draft assumptions are stored only in the local browser.


## Field discovery

The admin interface includes **Levantamiento** for capturing operational facts before any fiscal or RM-60 write integration.

It tracks the SUNMI/Inputsoft/SII incident, current commercial/payment baseline, and the four-scale RM-60 workflow. Unknown answers remain explicitly pending, and the screen generates a short question pack for Diana.

The module intentionally has no fields for passwords, API keys, card data or customer personal information.


## Discovery → Proposal bridge

The **Propuesta** screen automatically reads the current commercial baseline from **Levantamiento**.

Current fixed cost, effective card fee and monthly card sales can flow into the owner comparison without being entered twice. A field imported from discovery may continue to refresh while it still equals the previous imported value; manual proposal changes are preserved on later refreshes.

Proposed Point/ORBI costs remain independent assumptions and are never filled from the current-business discovery record.


## Owner pilot hub

For an owner-facing walkthrough, open:

~~~text
http://HOST:8787/piloto
~~~

The hub tells the ORBI story in five steps: Showcase, POS, four RM-60 scales, Point payments and the modernization proposal.

It deliberately separates **software that is ready to demonstrate** from **field/production validation that is still pending**. It does not imply that SUNMI/Inputsoft can already be removed or that real RM-60/Point integrations are complete.

Specific admin workspaces can also be linked directly with:

~~~text
/?view=sale
/?view=scale
/?view=payments
/?view=discovery
/?view=proposal
~~~


## Isolated owner demo session

For a complete sale walkthrough that cannot contaminate operational data, open:

~~~text
http://HOST:8787/piloto/sesion
~~~

This route uses only the illustrative demo catalog and keeps cart, Point simulation and result state in page memory. It does not publish catalog data, create Payment Core orders, persist real sales or emit SII documents.

The demo requires the simulated terminal step before an approval and only creates its in-memory demo receipt after status `processed`.


## Printable owner summary

Open:

~~~text
http://HOST:8787/piloto/resumen
~~~

The summary combines confirmed current-shop facts, the ORBI target architecture, software readiness, field validation, cost-benefit status and pending blockers.

Use **Imprimir / Guardar PDF** to open the browser print dialog. If the economic inputs are incomplete, the report explicitly remains without an economic conclusion rather than inventing savings.


## Production decision gate

Open:

~~~text
http://HOST:8787/piloto/decision
~~~

The gate separates **blocked**, **ready for owner decision**, and **approval recorded** states.

Automatic checks cover the real catalog, PLU coverage, observed four-scale behavior, confirmed RM-60 backup, field discovery and a calculable cost comparison. Separate manual evidence is required for the production fiscal path, a physical Point test and the rollback plan.

The final owner-approval control stays locked until every earlier prerequisite passes. Passing the gate does not enable RM-60 writes, call Mercado Pago, emit SII documents or perform a migration automatically.
