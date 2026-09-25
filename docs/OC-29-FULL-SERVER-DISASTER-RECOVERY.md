# OC-29 — Full Server Disaster Recovery Archive

## Goal

Recover the El Chunchito ORBI pilot after losing the entire server/mini-PC.

OC-28 protects browser-local control state.

OC-29 protects the allowlisted server-side store data required to rebuild the pilot on a replacement machine.

## Route

~~~text
/piloto/desastre
~~~

## Portable archive

Format:

~~~text
orbi-pos-server-dr/v1
~~~

Portable filename:

~~~text
dr-<uuid>.orbi-dr.gz
~~~

The archive is a gzip-compressed JSON envelope.

No third-party archive dependency is required.

## Why gzip + JSON

The envelope lets ORBI validate every path, byte count and SHA-256 before any restore.

Binary files are represented as base64 inside the envelope, then the complete envelope is gzip-compressed.

This is intentionally optimized for the current small trusted-LAN pilot, not for multi-gigabyte production archives.

Current limits:

~~~text
5,000 files
128 MB total raw file payload
180 MB uncompressed envelope
160 MB compressed archive
~~~

## Included server state

Only allowlisted paths can enter an archive:

~~~text
catalog.json
payments.json
sales.json
daily-closes.json
scale-fleet.json

assets/*.jpg|jpeg|png|webp

evidence/attachments/evidence-*.jpg|jpeg|png|webp|pdf
evidence/attachments/evidence-*.{media}.meta.json

pilot-backups/backup-<uuid>.json
~~~

Conceptually this protects:

- shared catalog and price-history snapshot;
- Payment Core historical order records;
- server-authoritative completed sales ledger;
- immutable OC-33 daily close revisions;
- documented DIGI RM-60 fleet state;
- product/Showcase image assets;
- OC-27 evidence binaries and metadata;
- OC-28 browser-state snapshots already copied to the server.

Unknown files are ignored during archive creation.

## Explicit exclusions

The archive does not read or serialize:

- process environment;
- Mercado Pago Access Token;
- webhook/HMAC secrets;
- API keys;
- TLS/private keys;
- source repository;
- node_modules;
- operating-system/user files;
- existing disaster-recovery archives.

The `disaster-recovery/` directory is excluded from its own archive to prevent recursive growth.

## Browser-state capture before manual archive

When the operator clicks **Crear archivo completo de recuperación** from the UI:

1. ORBI first creates a fresh OC-28 snapshot of the current browser-local pilot state;
2. that new `pilot-backups/backup-*.json` is now part of server state;
3. OC-29 then creates the full server archive.

This makes the portable server archive contain a recoverable copy of the latest:

- Levantamiento;
- Propuesta;
- Production Gate;
- Migration Runbook;
- Evidence Ledger;
- Case Binder.

After restoring a replacement server, the operator can use OC-28 to restore those browser modules into the new browser.

## Per-file integrity

Every archived file records:

~~~text
path
size
SHA-256
encoding=base64
content
~~~

Before accepting an imported archive, ORBI recalculates:

- decoded byte length;
- per-file SHA-256;
- total file bytes;
- file count;
- component list.

Any mismatch rejects the archive.

## Whole-archive integrity

Every stored `.orbi-dr.gz` also records:

- compressed byte size;
- SHA-256 of the exact gzip bytes;
- archive creation time;
- server save time;
- source;
- ingest mode;
- component list.

Preview/download validates the compressed size/hash and then validates the complete inner envelope.

## Import

Portable archive import:

~~~text
POST /api/stores/:storeId/disaster-recovery/import
Content-Type: application/gzip
~~~

Import does not restore anything.

The server:

1. checks compressed-size limit;
2. decompresses with an output limit;
3. parses JSON;
4. validates store identity;
5. validates every allowlisted path;
6. validates sizes/hashes/summary;
7. stores the verified archive under a new local archive ID.

Only after this can the operator open the restore preview.

## Path traversal protection

Each path must:

- be relative;
- use forward slashes;
- normalize to exactly the supplied path;
- contain no `..` traversal;
- match one of the explicit allowlist patterns.

Imported paths outside that contract are rejected.

Symlinks and unknown directory contents are not collected by archive creation.

## Restore confirmation

Restore requires the exact phrase:

~~~text
RESTORE el-chunchito
~~~

The phrase is checked server-side.

## Automatic full-server safety archive

Before replacing any live server data, OC-29 creates another complete archive:

~~~text
source = pre-restore
~~~

This archive is stored in `disaster-recovery/archives/`, which the restore itself never replaces.

If safety-archive creation fails, the restore stops.

## Staged restore

Restore does not write imported file bytes directly over live files.

It first creates a temporary staging tree and verifies every staged file again.

Protected live targets are:

~~~text
catalog.json
payments.json
sales.json
daily-closes.json
scale-fleet.json
assets/
evidence/attachments/
pilot-backups/
~~~

The restore transaction moves existing live targets into a temporary previous-state tree, installs staged targets, and removes the transaction tree only after success.

If an error occurs during replacement, ORBI attempts to remove newly installed targets and rename the previous targets back into place.

The pre-restore archive remains available as the durable recovery path.

## Payment boundary

`payments.json` contains ORBI Payment Core historical order records.

Restoring those records:

- does not create a payment;
- does not call Mercado Pago;
- does not reconcile provider orders automatically;
- does not restore Mercado Pago credentials.

A replacement server must configure provider credentials separately.

## SII / RM-60 boundary

OC-29 never:

- emits DTE/boleta;
- contacts SII;
- writes to a DIGI RM-60;
- changes a scale price;
- initiates a Point transaction.

It only restores ORBI server files.

## API

~~~text
GET  /api/stores/:storeId/disaster-recovery/archives
POST /api/stores/:storeId/disaster-recovery/archives

POST /api/stores/:storeId/disaster-recovery/import

GET  /api/stores/:storeId/disaster-recovery/archives/:archiveId
GET  /api/stores/:storeId/disaster-recovery/archives/:archiveId/download

POST /api/stores/:storeId/disaster-recovery/archives/:archiveId/restore
~~~

There is no DELETE endpoint.

## Replacement-machine recovery flow

~~~text
OLD SERVER
    ↓
fresh OC-28 browser snapshot
    ↓
create OC-29 full archive
    ↓
download .orbi-dr.gz
    ↓

REPLACEMENT SERVER
    ↓
install ORBI POS code/runtime
    ↓
configure ORBI data directory
    ↓
configure provider secrets separately
    ↓
import .orbi-dr.gz
    ↓
verify preview + hashes
    ↓
RESTORE el-chunchito
    ↓
server data restored
    ↓
open OC-28
    ↓
restore browser-local pilot state
~~~

## Operating principle

~~~text
Credentials/configuration are infrastructure.
Business/pilot state is recoverable data.

Do not mix them in the same archive.
~~~
