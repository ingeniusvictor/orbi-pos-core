# OC-19 — Field Discovery & SUNMI/Inputsoft/SII Incident Intake

## Goal

Capture the missing real-world information from Carnicería El Chunchito before ORBI changes any fiscal or scale workflow.

The module is documentation only.

It does not connect to:

- SII;
- Inputsoft;
- SUNMI;
- DIGI RM-60 devices;
- Mercado Pago.

## Known facts preserved

ORBI displays the currently confirmed shop facts:

~~~text
4 × DIGI RM-60
one staff-described principal RM-60
price administration currently performed from that principal scale
SUNMI V2 + Inputsoft used in the current boleta workflow
reported SII transmission issue with exact cause still unknown
~~~

Unknown answers remain explicitly pending.

## Three discovery tracks

### 1. SUNMI / Inputsoft / SII incident

Capture:

- whether a boleta still prints during the issue;
- whether an error appears;
- issue frequency;
- who reported/detected it;
- approximate period;
- whether affected documents were found in SII verification;
- suspected scope: individual boletas, daily summary, both, or unknown;
- non-sensitive visible system/page reference;
- exact visible error text;
- evidence notes.

ORBI does not infer a tax diagnosis from these answers.

### 2. Commercial baseline

Capture:

- whether SUNMI is purchased, rented, bundled or still unknown;
- verified fixed monthly cost;
- current card acquirer;
- effective average card commission;
- approximate monthly card volume;
- evidence/source note.

These fields can later be used to populate the modernization cost-benefit analysis after validation.

### 3. Four RM-60 scales

Capture:

- whether the full principal-scale price-change workflow has been observed;
- whether the other three scales update automatically;
- propagation delay/behavior if observed;
- whether a management page/program exists;
- non-sensitive program/page reference;
- PLU export/list availability;
- backup availability before any future write integration.

## Readiness

Each track has an explicit completion indicator.

An answer of **Consultado, aún no se sabe** counts as an observed answer because it records that the question was checked without inventing a conclusion.

Pending answers remain blockers.

## Question pack

The module automatically generates only the questions that are still pending.

The operator can copy the remaining questions to WhatsApp for Diana.

As answers are entered, the question list becomes shorter.

## Export

The discovery can be exported as:

~~~text
orbi-pos-field-discovery/v1
~~~

The JSON includes:

- known project facts;
- explicit answers;
- operational notes;
- a safety warning.

## Sensitive-data boundary

Do **not** record:

- SII passwords;
- Inputsoft passwords;
- Mercado Pago Access Tokens;
- API keys;
- cardholder/card data;
- customer personal information.

No credential field exists in the model.

The free-text fields are visibly marked as operational notes only.

## Local persistence

Pilot data is stored only in the browser under:

~~~text
orbi-pos:field-discovery
~~~

It is not synchronized into the product catalog or customer Showcase.
