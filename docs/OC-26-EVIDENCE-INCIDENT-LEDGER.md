# OC-26 — Pilot Evidence & Incident Ledger

## Goal

Keep one local audit trail for the facts, incidents, decisions, tests and safe evidence references collected during the El Chunchito pilot.

The ledger answers:

~~~text
What happened?
When?
Which system?
Who observed/verified it?
What evidence reference exists?
What changed afterward?
~~~

## Route

~~~text
/piloto/evidencia
~~~

The route is linked from:

- the owner pilot hub;
- OC-24 Production Decision Gate;
- OC-25 Controlled Migration Runbook;
- the printable owner summary.

## Record types

~~~text
observation
test
incident
decision
document
~~~

## Systems / domains

~~~text
general
rm60
sunmi-inputsoft
sii
point
pos
showcase
catalog
migration
~~~

## Entry model

Each entry contains:

- immutable local ID;
- occurred-at timestamp;
- created-at timestamp;
- type;
- system/domain;
- severity;
- current status;
- short title;
- factual summary;
- observer/verifier role or name;
- optional safe evidence reference;
- source context/module;
- status-history events.

There is no delete action in the OC-26 UI.

## Status history

Supported statuses:

~~~text
open
verified
resolved
superseded
~~~

A status change requires a note.

The original history remains attached to the entry:

~~~text
created
open -> verified
verified -> resolved
~~~

This lets later evidence correct or close an earlier observation without erasing what the pilot team knew at that time.

## Dashboard metrics

OC-26 displays:

- open incidents;
- critical active entries;
- verified evidence;
- recorded decisions.

Critical active means severity `critical` with status `open` or `verified`.

## Filters

The timeline can be filtered by:

- free-text search;
- record type;
- system/domain;
- status;
- severity.

## Evidence reference boundary

OC-26 does not upload binary attachments.

A safe reference can be:

- screenshot filename;
- ticket/reference number;
- document name;
- non-secret URL;
- safe local evidence identifier.

The actual files can be managed separately.

## Sensitive-data guard

The ledger explicitly forbids:

- passwords;
- API keys;
- access tokens;
- client secrets;
- Bearer tokens;
- card numbers;
- customer personal information.

A lightweight guard rejects some obvious patterns in free text, including labeled credentials and possible 13–19 digit card-number patterns.

This is only a guardrail.

It does not guarantee that every secret or personal datum can be detected automatically.

The operator must still review entries before saving/sharing.

## Persistence

OC-26 uses a dedicated local key:

~~~text
orbi-pos:evidence-ledger
~~~

It does not mutate:

- catalog;
- sales;
- Payment Core;
- field discovery;
- modernization proposal;
- production gate;
- migration runbook.

## Export

The ledger can be exported as:

~~~text
orbi-pos-evidence-ledger-export/v1
~~~

The JSON includes:

- dashboard statistics;
- entries;
- status history;
- explicit safety metadata.

Review the JSON before sharing it outside the pilot environment.

## Operating rule

~~~text
Do not delete history.
Correct it with newer evidence.
~~~

If an earlier conclusion becomes wrong:

- mark it superseded/resolved with a reason; and/or
- add a new evidence entry.

This preserves the chain of reasoning behind future production decisions.
