# OC-03 — Shared Catalog Sync for TV Showcase

## Pilot architecture

OC-03 deliberately uses a small **LAN-first sync server** instead of requiring a cloud platform for the first El Chunchito installation.

```text
Owner/admin browser
       |
       | HTTP on local network
       v
ORBI POS Sync Server
       |
       +---- catalog.json (persistent local data)
       |
       +----------------------------+
       |                            |
       v                            v
Admin ORBI POS                 TV /showcase
(read + write)                 (read/poll)
```

This lets the first real pilot run with one computer on the shop network plus a TV/browser device. Internet access is not required for catalog updates while both devices are on the same LAN.

## How it works

The server exposes:

- `GET /api/health`
- `GET /api/stores/:storeId/catalog`
- `PUT /api/stores/:storeId/catalog`

Every catalog snapshot has a monotonically increasing `revision`.

Writes include `baseRevision`. A stale writer receives HTTP 409 and the current server snapshot, preventing silent overwrites.

The web app:

- detects the sync server automatically;
- falls back to browser-local mode when no server is available;
- polls every 3 seconds when shared sync is available;
- caches the last catalog locally;
- keeps the Showcase visible during a temporary network outage;
- retries connection automatically;
- keeps a pending local edit and republishes it when the server returns if no newer remote revision appeared.

## Running the LAN pilot

Development uses two terminals:

```bash
npm install
npm run dev:sync
npm run dev:web
```

Vite proxies `/api` to the local sync server.

For a single-process pilot:

```bash
npm install
npm run build
npm start
```

The sync server listens on port `8787` by default and also serves the built ORBI POS web app.

From another device on the same network, open the host computer's LAN address, for example:

```text
http://HOST-LAN-IP:8787/
http://HOST-LAN-IP:8787/showcase
```

The exact LAN IP depends on the computer/network and is intentionally not hard-coded.

## Storage

Default server data directory:

```text
services/sync-server/data/
```

Override with:

```text
ORBI_POS_DATA_DIR=/path/to/persistent/storage
```

Store id defaults to:

```text
el-chunchito
```

A different web store id can be supplied at build time through `VITE_ORBI_STORE_ID`.

## Security boundary

This OC-03 server is for a trusted local network pilot.

It has no user authentication yet and **must not be exposed directly to the public internet**. Before any cloud/public deployment, add authenticated owner/admin writes and deployment hardening.

## What OC-03 does not do

- no RM-60 write operations;
- no SII/DTE handling;
- no payment processing;
- no cloud account system;
- no employee permissions.

## Acceptance target

OC-03 is complete when:

- server-side catalog revisions persist;
- admin and Showcase on different browsers receive the same prices;
- TV refreshes within a few seconds after an admin change;
- last known catalog remains visible during temporary server/network loss;
- stale writes do not silently overwrite newer catalog data;
- tests and build are green.
