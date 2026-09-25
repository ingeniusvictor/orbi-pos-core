# OC-27 — Evidence Attachments & Case Binder

## Goal

Extend the OC-26 audit ledger with validated binary evidence and a case-binder layer.

OC-27 keeps two ideas separate:

1. **OC-26 ledger entries remain append-only facts/decisions.**
2. **OC-27 cases organize those entries and evidence files into dossiers.**

## Route

~~~text
/piloto/expedientes
~~~

## Supported evidence files

Pilot scope:

~~~text
JPG
PNG
WebP
PDF
~~~

Maximum size:

~~~text
20 MB per file
~~~

No Office files, archives, scripts or executables are accepted.

## Trusted-LAN server storage

Evidence binaries are stored under the ORBI POS sync-server data directory.

The browser never chooses the server filesystem path.

Uploaded files use an opaque generated name:

~~~text
evidence-<uuid>.pdf
evidence-<uuid>.png
~~~

The original filename is metadata only.

## Server validation

Before saving an evidence file, the server verifies:

- store id;
- opaque filename pattern;
- extension;
- Content-Type;
- maximum size;
- magic-file signature.

Supported signatures:

- JPEG;
- PNG;
- WebP;
- PDF (`%PDF-`).

A MIME/extension mismatch or fake payload is rejected.

## Integrity metadata

Each accepted file stores:

- opaque filename;
- original filename;
- MIME type;
- size in bytes;
- SHA-256 digest;
- upload timestamp;
- optional case ID;
- optional OC-26 entry ID.

The UI displays the full SHA-256 digest.

## No delete endpoint

OC-27 intentionally provides:

- list;
- upload;
- fetch/open.

It does **not** provide a binary delete endpoint.

A file can be unlinked from a case, but the stored binary remains available for audit/recovery.

## Case model

A case contains:

- immutable case ID;
- title;
- system/domain;
- case type;
- status;
- factual summary;
- created/updated timestamps;
- linked OC-26 entry IDs;
- linked evidence attachment IDs;
- append-only case history.

Case types:

~~~text
incident
test
decision-support
migration
~~~

Case statuses:

~~~text
open
monitoring
closed
superseded
~~~

## Linking behavior

Linking or unlinking an OC-26 entry does not modify the original ledger entry.

The case binder stores the relationship separately.

The case history records:

- case creation;
- status transitions;
- ledger-entry link/unlink;
- attachment link/unlink.

## Status transitions

Changing a case status requires a note.

The note is added to case history instead of overwriting prior context.

## Attachment-to-entry relationship

When uploading a file, the operator may optionally select one of the OC-26 entries already linked to the case.

The resulting attachment metadata then records both:

~~~text
caseId
entryId
~~~

## Sensitive-data boundary

Binary files cannot be reliably scanned by the lightweight OC-26 text guard.

Before upload, the operator must review files and avoid:

- passwords;
- API keys;
- access tokens;
- card data;
- customer personal information.

OC-27 validates file format and integrity, **not semantic confidentiality**.

## API

Trusted-LAN endpoints:

~~~text
GET /api/stores/:storeId/evidence/attachments

GET /api/stores/:storeId/evidence/attachments/:fileName

PUT /api/stores/:storeId/evidence/attachments/:fileName
~~~

No DELETE endpoint exists in OC-27.

## Local binder persistence

Case metadata is stored separately at:

~~~text
orbi-pos:evidence-cases
~~~

The binary files live on the sync server.

## Export

The binder exports metadata as:

~~~text
orbi-pos-evidence-case-binder-export/v1
~~~

The JSON export can contain:

- case metadata/history;
- linked entry IDs;
- attachment metadata;
- SHA-256 hashes.

Binary file contents are not embedded.

## Isolation

OC-27 does not mutate:

- catalog;
- sales;
- Payment Core;
- field discovery;
- modernization proposal;
- OC-24 gate;
- OC-25 migration runbook;
- OC-26 ledger entries.

## Operating principle

~~~text
Ledger = what happened.
Case = why these facts belong together.
Attachment = file evidence with integrity metadata.
~~~
