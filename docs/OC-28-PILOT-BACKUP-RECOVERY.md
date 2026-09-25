# OC-28 — Pilot State Backup & Recovery Bundle

## Goal

Protect the pilot against loss of browser-local state when:

- the browser cache/localStorage is cleared;
- the pilot is opened on another PC;
- the browser profile changes;
- an operator needs to restore an earlier pilot-control state.

OC-28 backs up only the browser-resident pilot-control modules.

## Route

~~~text
/piloto/respaldo
~~~

## Protected modules

Each snapshot contains all six modules:

~~~text
fieldDiscovery
modernizationProposal
productionGate
migrationRunbook
evidenceLedger
evidenceCases
~~~

These map to:

~~~text
orbi-pos:field-discovery
orbi-pos:modernization-proposal
orbi-pos:production-gate
orbi-pos:migration-runbook
orbi-pos:evidence-ledger
orbi-pos:evidence-cases
~~~

A fresh/missing module is backed up as its sanitized safe default.

## Not restored by OC-28

OC-28 intentionally does not rewrite:

- catalog;
- price history on the shared server;
- RM-60 fleet state;
- payment/provider audit;
- evidence binaries;
- SUNMI/Inputsoft;
- SII;
- physical Point devices.

These have separate operational/server boundaries.

## Bundle format

~~~text
orbi-pos-pilot-backup/v1
~~~

A bundle contains:

- business;
- store ID;
- creation timestamp;
- label;
- source;
- six sanitized modules;
- catalog reference metadata;
- OC-27 evidence-attachment manifest metadata;
- explicit safety metadata.

The attachment manifest contains metadata/hash only, not binary files.

## Server persistence

Trusted-LAN API:

~~~text
GET  /api/stores/:storeId/pilot-backups
GET  /api/stores/:storeId/pilot-backups/:backupId
POST /api/stores/:storeId/pilot-backups
~~~

OC-28 adds no DELETE endpoint.

Each server record contains:

- opaque backup ID;
- bundle creation timestamp;
- server save timestamp;
- label;
- source;
- module count;
- serialized size;
- SHA-256 digest;
- validated bundle.

Files are written atomically to the store data directory.

## Backup sources

~~~text
manual
pre-restore
portable-import
~~~

`pre-restore` is reserved for the automatic safety snapshot created immediately before a restore.

## Portable copy

The UI can download a raw bundle JSON.

This copy can be stored outside the pilot PC and later imported.

Importing a JSON file:

1. validates JSON;
2. validates the ORBI format;
3. verifies the store ID;
4. rejects unknown modules;
5. scans for obvious forbidden credential/card patterns;
6. sanitizes every module;
7. opens the bundle in preview mode.

Import alone does not write localStorage.

## Restore workflow

A restore is selective.

The operator chooses any subset of:

- Levantamiento;
- Propuesta;
- Gate;
- Runbook;
- Ledger;
- Expedientes.

Before writing selected modules, ORBI must successfully create a new:

~~~text
pre-restore
~~~

snapshot from the current browser state.

If the safety snapshot cannot be saved, the restore is stopped.

After selected modules are written, the page reloads so every screen re-reads local state.

## Module sanitization

Where domain sanitizers already exist, OC-28 reuses them:

- production gate;
- migration runbook;
- evidence ledger;
- evidence cases.

Field discovery and proposal have dedicated backup sanitizers that:

- keep only known fields;
- normalize enum values;
- accept only finite non-negative monetary values;
- constrain percentage fields to 0–100;
- replace invalid values with safe defaults.

## Sensitive-data guard

Both browser and server validate the module payload.

Guardrails reject:

- key names that look like password/secret/token/API-key/authorization/credential/card fields;
- obvious labeled password/API-key/token text;
- Bearer-looking tokens;
- possible 13–19 digit card numbers.

This is not semantic DLP.

Operators must still avoid placing secrets or customer personal information in pilot notes.

## Server references

The backup records the catalog state only as reference metadata:

~~~text
revision
updatedAt
productCount
~~~

It does not embed or restore the catalog.

OC-27 evidence references include:

~~~text
fileName
contentType
size
sha256
uploadedAt
caseId
entryId
~~~

Binary files remain in the server evidence store.

## Recovery guarantee boundary

OC-28 protects browser-resident control state against browser/profile/device changes as long as the trusted-LAN server backup or a portable JSON copy remains available.

It is **not** yet a complete physical-server disaster archive because OC-27 binaries and other server data are not embedded in the bundle.

## Operating rule

~~~text
Before destructive restore:
    current state
        ↓
    pre-restore snapshot
        ↓
    validate source bundle
        ↓
    restore selected modules
        ↓
    reload
~~~

No restore should silently overwrite current pilot-control state without a recoverable pre-restore snapshot.
