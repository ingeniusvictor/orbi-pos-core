# OC-30 — Recovery Drill & Integrity Certification

## Goal

OC-29 creates full-server disaster-recovery archives.

OC-30 proves whether a selected archive can actually be reconstructed and reopened without touching the live pilot.

The operating principle is:

~~~text
backup exists
    ≠
backup is proven recoverable
~~~

## Route

~~~text
/piloto/certificacion
~~~

## Drill behavior

For one existing OC-29 archive, ORBI:

1. verifies the stored compressed-size and whole-archive SHA-256;
2. validates/decompresses the OC-29 envelope;
3. verifies every internal path, byte length and SHA-256;
4. creates an isolated temporary sandbox in the operating-system temp area;
5. physically reconstructs every archived file into a fake ORBI data directory;
6. reads every staged file back from disk and verifies size/hash again;
7. opens reconstructed components using the real ORBI store classes;
8. compares the archive manifest with current live allowlisted server state;
9. removes the temporary sandbox;
10. persists an immutable certification report with its own SHA-256.

The drill never calls the OC-29 live restore function.

## Result states

~~~text
certified
certified_with_drift
failed
~~~

### certified

The archive:

- passed integrity checks;
- reconstructed in the temporary sandbox;
- passed component/domain checks;
- and the current allowlisted live state still matches the archive manifest.

### certified_with_drift

The archive itself passed reconstruction and domain checks, but current live state changed after the snapshot.

Drift is reported separately from corruption.

Examples:

~~~text
catalog.json changed after backup
new OC-28 backup exists
new evidence attachment exists
an older archive path is no longer live
~~~

A drift result does not mean the tested archive is corrupt.

### failed

One or more integrity, reconstruction or component checks failed.

## Component validation

### Catalog

When `catalog.json` is present:

- parse JSON;
- verify store ID;
- verify revision;
- verify product array;
- verify price-history array;
- reopen using `CatalogStore`.

### Payment Core history

When `payments.json` is present:

- parse JSON;
- require an orders array;
- reopen through `PaymentStore`.

The drill never instantiates a payment provider runtime and does not call Mercado Pago.

### Server-authoritative sales

When `sales.json` is present:

- parse the sales ledger;
- verify store identity and client request identity;
- verify sale lines and CLP-10 subtotal math;
- verify total equals line totals;
- verify card sales contain provider trace structure;
- reject provider traces on cash/transfer records;
- reopen through `SaleStore`.

The drill does not call a payment provider.

### DIGI RM-60 fleet

When `scale-fleet.json` is present:

- reopen through `ScaleFleetStore`;
- verify the store ID;
- require at least one device;
- require exactly one principal device.

No RM-60 communication is performed.

### Product image assets

For each archived product image:

- reconstruct the file;
- verify archive hash after disk write;
- verify JPG/PNG/WebP magic signature;
- verify the reconstructed set through `AssetStore.list`.

### OC-27 evidence

Evidence binaries and their `.meta.json` files are paired.

The drill checks:

- equal binary/metadata counts;
- expected metadata filename;
- metadata SHA-256 against reconstructed binary;
- `EvidenceAttachmentStore.list` consistency.

### OC-28 pilot backups

Every reconstructed `pilot-backups/backup-*.json` must be accepted by `PilotBackupStore.list`.

This re-runs the OC-28 stored-record integrity logic.

## Live drift comparison

After proving the archive in the sandbox, OC-30 generates a current allowlisted manifest from the live server and compares:

~~~text
path + SHA-256
~~~

The report separates:

~~~text
matching
changed
newLive
archiveOnly
~~~

No file content is added to the drift report.

## Certification record

Format:

~~~text
orbi-pos-recovery-drill/v1
~~~

Each report records:

- certification ID;
- store ID;
- OC-29 archive ID;
- archive SHA-256;
- start/completion timestamps;
- duration;
- result;
- archive file/byte counts;
- physically staged file/byte counts;
- check results;
- component results;
- live drift;
- safety flags.

The report itself is hashed:

~~~text
reportSha256 = SHA-256(JSON(certificate))
~~~

On later read/list, the hash is recomputed.

A modified certification record is rejected/omitted.

## Server persistence

Certification records live under:

~~~text
stores/<storeId>/disaster-recovery/certifications/
~~~

They are intentionally outside the OC-29 protected restore targets.

OC-29 does not recursively archive its own disaster-recovery area.

## API

~~~text
GET  /api/stores/:storeId/disaster-recovery/certifications
GET  /api/stores/:storeId/disaster-recovery/certifications/:certificateId

POST /api/stores/:storeId/disaster-recovery/archives/:archiveId/drill
~~~

No DELETE endpoint exists.

## Sandbox cleanup

Temporary reconstruction is created under the operating-system temporary directory.

After the drill, ORBI removes only that sandbox.

The certificate records whether cleanup succeeded:

~~~text
sandboxCleaned
~~~

A cleanup problem is a warning and does not cause ORBI to modify live business data.

## Safety boundary

A recovery drill never:

- replaces live catalog files;
- replaces live payment history;
- modifies RM-60 fleet data;
- calls Mercado Pago;
- creates or reconciles a provider order;
- emits a SII document;
- writes to a physical scale;
- captures runtime environment secrets.

## Recovery confidence chain

~~~text
OC-28
browser state backup
       ↓
OC-29
full-server portable archive
       ↓
OC-30
isolated reconstruction drill
       ↓
integrity + domain certification
~~~

The result is not merely “a backup file exists”.

It is evidence that a specific archive was actually reconstructed and checked.
