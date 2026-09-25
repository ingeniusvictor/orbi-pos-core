# OC-24 — Production Decision Gate

## Goal

Prevent the ORBI pilot from being described as ready for a real migration while critical evidence is still missing.

The gate is a decision-support control. ORBI does not authorize a business migration by itself.

## Route

~~~text
/piloto/decision
~~~

The route is linked from:

- the owner pilot hub;
- the printable owner summary.

## States

### BLOCKED

One or more technical, commercial or operational prerequisites are missing.

The pilot and demo may continue, but the page states:

~~~text
NO PASAR A PRODUCCIÓN
~~~

### READY FOR OWNER DECISION

All automatic and manual technical prerequisites have evidence, but the owner decision has not been recorded.

ORBI does not automatically cross this boundary.

### CONTROLLED MIGRATION APPROVAL RECORDED

All prerequisites pass and an owner approval note has been recorded.

This state means the pilot record contains the required decision evidence.

It does **not** replace:

- contracts;
- tax/legal obligations;
- vendor approvals;
- Mercado Pago requirements;
- SII requirements.

## Automatic gates

OC-24 derives these from existing ORBI state:

1. active real catalog exists;
2. all active products have numeric PLU;
3. principal RM-60 price workflow was observed;
4. behavior of the three secondary RM-60 devices was observed as yes/no;
5. recoverable RM-60 backup was positively confirmed;
6. SUNMI/Inputsoft/SII minimum discovery is complete;
7. commercial baseline is complete;
8. modernization cost comparison is calculable.

### Economic rule

The production gate does not require ORBI to be cheaper.

A more expensive proposal can still be ready for an owner decision if the comparison is complete. Cost outcome remains information for the owner, not a software approval criterion.

## Manual evidence gates

Stored separately under:

~~~text
orbi-pos:production-gate
~~~

### Fiscal production path

The operator must explicitly record one path:

~~~text
retain-current-verified
new-flow-validated
~~~

and add a non-sensitive evidence note.

Completing the SUNMI/SII discovery alone does not pass this gate.

### Physical Point test

A real Point Smart 2 controlled test must be recorded with evidence.

The local Point simulator does not pass this production gate.

### Rollback plan

The operator records that a recovery/reversal procedure exists, with a note describing where the plan/evidence can be found.

### Owner decision

The owner decision control remains disabled until all other prerequisites pass.

It requires an evidence note.

## Evidence-note rule

A manual checkbox/selection is not enough.

Each manual gate requires a non-empty evidence note before being considered verified.

Do not store:

- passwords;
- Mercado Pago access tokens;
- API keys;
- cardholder/card data;
- customer personal information.

## RM-60 boundary

Passing OC-24 does not certify automatic RM-60 writes.

The gate validates:

- PLU coverage;
- observed topology;
- backup availability.

A future automatic-write feature still requires its own protocol/configuration validation and controlled commissioning.

## Fiscal boundary

A complete discovery questionnaire is not tax approval.

The separate fiscal production-path gate exists specifically so ORBI cannot confuse discovery completeness with a production-ready SII path.

## Reset behavior

**Reiniciar evidencia manual** deletes only OC-24 manual evidence.

It does not modify:

- catalog;
- PLU mapping;
- field discovery;
- modernization proposal;
- payment data.

## Tests

Pure-model tests verify:

- missing evidence => blocked;
- economic comparison can pass even when proposed cost is higher;
- manual checks require evidence notes;
- owner approval cannot override missing technical prerequisites;
- final approval is recorded only after all earlier gates pass;
- persisted manual values are sanitized.
