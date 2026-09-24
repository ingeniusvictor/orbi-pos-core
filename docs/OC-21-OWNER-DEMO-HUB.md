# OC-21 — Owner Demo Hub & Pilot Readiness

## Goal

Give Carnicería El Chunchito one owner-facing URL that explains the ORBI modernization proposal from end to end.

The hub is not an admin dashboard and is not a production-readiness certificate.

It is a guided demonstration surface.

## Route

~~~text
/piloto
~~~

The route is also available from the ORBI admin navigation through **Piloto ↗**.

## Guided story

The hub presents five steps:

1. **ORBI Showcase**
   - opens `/showcase-demo`;
   - demonstrates the 16:9 customer display;
   - demo prices/products remain explicitly illustrative.

2. **ORBI POS**
   - opens `/?view=sale`;
   - demonstrates the visual cashier flow.

3. **4 × DIGI RM-60**
   - opens `/?view=scale`;
   - shows the four-device registry and PLU mapping;
   - does not claim verified synchronization between scales.

4. **Point Smart 2**
   - opens `/?view=payments`;
   - demonstrates the payment state model and mock Point flow;
   - no real money moves in mock mode.

5. **Cost / benefit**
   - opens `/modernizacion`;
   - uses the evidence-aware proposal calculator;
   - no economic conclusion is forced while required data is missing.

## Demo readiness vs real deployment

OC-21 deliberately shows two different scoreboards.

### Software / demo readiness

Examples:

- Showcase demo available;
- POS available;
- RM-60 fleet representation available;
- Mock Point available;
- proposal calculator available.

A partial state is valid when the software can be shown but real business inputs are incomplete.

### Field / production validation

Examples:

- real PLU coverage;
- observed behavior between the four RM-60 scales;
- SUNMI/Inputsoft/SII discovery completeness;
- current commercial baseline completeness;
- real Point Smart 2 association/configuration.

These checks are never inferred from the existence of demo software.

## Dynamic readiness rules

### PLU

Ready only when every active product has a numeric PLU matching:

~~~text
1–6 digits
~~~

### Four-scale behavior

Ready only when:

- the principal price-update workflow was observed; and
- secondary propagation was explicitly observed as yes or no.

An answer of **unknown** does not count as verified topology.

### SUNMI / SII

The hub reuses the OC-19 minimum-question readiness model.

Even when those questions are complete, the UI explicitly states that this does not equal a final tax diagnosis.

### Commercial baseline

Ready only when the OC-19 commercial baseline has explicit answers for its required fields.

### Point Smart 2 physical terminal

Remains pending until a real device is deliberately acquired/associated and its production identifiers/mode are configured.

## Direct admin links

OC-21 adds URL-driven admin navigation:

~~~text
/?view=sale
/?view=prices
/?view=products
/?view=scale
/?view=payments
/?view=showcase
/?view=discovery
/?view=proposal
/?view=diagnostics
~~~

The app initializes from a valid `view` query parameter and keeps the current view reflected in the URL.

## Presentation boundary

The hub explicitly says:

~~~text
ORBI demonstrates first.
The business decides after field verification and cost comparison.
~~~

It does not recommend:

- disconnecting SUNMI/Inputsoft immediately;
- writing to RM-60 devices before backup/protocol validation;
- buying Point before costs and integration requirements are known;
- treating a completed discovery checklist as tax approval.
