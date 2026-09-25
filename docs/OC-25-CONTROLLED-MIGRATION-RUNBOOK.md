# OC-25 — Controlled Migration Runbook

## Goal

Convert a future approved ORBI cutover into a controlled, observable and reversible operating procedure.

OC-25 is not an automation engine.

It does not send commands to:

- DIGI RM-60;
- Mercado Pago;
- SUNMI;
- Inputsoft;
- SII.

It records the controlled migration procedure and the evidence observed during that procedure.

## Route

~~~text
/piloto/migracion
~~~

The route is linked from:

- the owner pilot hub;
- OC-24 Production Decision Gate.

## OC-24 lock

The runbook can always be opened in preview mode.

Execution controls remain locked until OC-24 evaluates to:

~~~text
approval-recorded
~~~

This prevents a prepared checklist from being mistaken for authorization to migrate.

## Window setup

Before starting an approved runbook, the operator must record:

- date;
- start time;
- target end time;
- lead operator.

A support/coordination note is optional.

The runbook remains in:

~~~text
draft
~~~

until the gate and minimum scheduling data are complete.

## Phases

### 01 — Preparation

Critical checks:

- safe previous operating flow remains available;
- RM-60 backup can actually be located/recovered now.

Supporting check:

- responsible people/support are available.

### 02 — Preflight

Critical checks:

- catalog + PLU baseline;
- four RM-60 baseline;
- fiscal baseline;
- physical Point availability;
- rollback route review.

Every critical Preparation + Preflight item must pass before GO is enabled.

### 03 — GO / NO-GO

~~~text
GO
~~~

is available only when all critical preflight checks pass.

~~~text
NO-GO
~~~

stops the runbook and keeps the safe previous operation unchanged.

### 04 — Controlled pilot

After GO:

- weigh/product validation;
- authoritative Point payment confirmation;
- fiscal-document verification;
- post-test RM-60 verification.

### 05 — Stabilization

The pilot remains limited while ORBI records:

- observation window without critical incidents;
- continued recoverability of the safe previous flow;
- optional staff observations.

### 06 — Closeout

Critical final reconciliation must pass before the runbook can be completed.

Completing OC-25 does not automatically expand the deployment.

## Evidence rule

A step cannot be marked:

~~~text
passed
failed
~~~

without a non-sensitive evidence note.

Examples:

- what was checked;
- observed result;
- operator/responsible;
- reference to a safe document or screenshot.

Do not store:

- passwords;
- Access Tokens;
- API keys;
- cardholder/card data;
- customer personal data.

## Critical failure behavior

If a critical active step fails:

~~~text
executionState = rollback-required
~~~

Normal migration steps immediately lock.

The rollback section becomes active.

## Rollback checklist

The runbook requires all critical recovery steps:

1. stop the controlled ORBI path;
2. restore the safe previous flow;
3. verify fiscal operation after recovery;
4. verify the four RM-60 devices;
5. document the incident and observed cause.

Rollback cannot close until every recovery step passes.

Final rollback state:

~~~text
rolled-back
~~~

## Successful close

A normal completion requires:

- OC-24 still approval-recorded;
- GO selected;
- every critical non-rollback step passed;
- no active rollback requirement.

Final normal state:

~~~text
completed
~~~

## Persistence

Runbook state is stored separately at:

~~~text
orbi-pos:migration-runbook
~~~

Resetting the runbook does not modify:

- catalog;
- PLU;
- OC-19 field discovery;
- OC-18 proposal;
- OC-24 gate evidence;
- payment audit data.

## Export

The runbook can be exported as sanitized JSON:

~~~text
orbi-pos-migration-runbook-export/v1
~~~

The export states explicitly that it contains an operational record only and does not perform migration actions.

## Why this exists

The target operating principle is:

~~~text
Approve with evidence
        ↓
Prepare
        ↓
Preflight
        ↓
GO / NO-GO
        ↓
One controlled pilot
        ↓
Observe
        ↓
Close
        OR
Rollback
~~~

No production cutover should depend on memory or improvisation.
