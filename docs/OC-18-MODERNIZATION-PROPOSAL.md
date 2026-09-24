# OC-18 — Owner Modernization Proposal & Cost-Benefit Calculator

## Goal

Convert the technical ORBI pilot into an owner-facing modernization proposal for Carnicería El Chunchito.

The proposal must clearly separate:

- facts confirmed in the shop;
- points still pending verification;
- the target ORBI architecture;
- cost assumptions entered from real invoices/quotes.

## Owner presentation

Two entry points are available:

~~~text
Admin -> Propuesta
/modernizacion
~~~

The standalone route is intended for meetings or presentation on a larger screen.

## Current-operation facts

The presentation currently shows:

- four DIGI RM-60 scales;
- one staff-described principal RM-60 used to update prices;
- SUNMI V2 + Inputsoft;
- reported SII transmission incident still under investigation;
- current monthly contract cost pending a real invoice;
- current payment commissions pending provider/statement evidence.

No unverified cost is presented as fact.

## Proposed architecture

The target proposal is:

~~~text
4 × DIGI RM-60
        |
        v
      ORBI
 catalog / prices / POS / Showcase
        |
        v
Point Smart 2 candidate
 Orders API / confirmed card payment
        |
        v
Fiscal flow only after explicit validation
~~~

The four RM-60 scales are retained.

Automatic RM-60 writes remain outside this proposal until the supported protocol/topology is verified.

The SUNMI/Inputsoft fiscal path is not declared replaced until the current SII issue is understood and the desired tax-document model is confirmed.

## Cost-benefit calculator

The calculator intentionally starts empty.

Required inputs:

~~~text
Current fixed monthly cost
Current effective average card fee %
Monthly card sales
Proposed fixed monthly cost
Proposed effective average card fee %
~~~

Optional initial investment:

~~~text
Point terminal purchase
Showcase TV
Mini-PC / player
~~~

Calculation:

~~~text
current monthly =
  current fixed
  + monthly card sales × current average fee %

proposed monthly =
  proposed fixed
  + monthly card sales × proposed average fee %

monthly difference =
  current monthly - proposed monthly

annual difference =
  monthly difference × 12

payback months =
  initial investment / positive monthly difference
~~~

If required values are missing, ORBI displays **Sin conclusión**.

If the proposed system is more expensive under the supplied assumptions, ORBI displays that result instead of forcing a positive recommendation.

## Evidence fields

The proposal contains free-text fields for recording the evidence behind both scenarios, for example:

~~~text
Current:
Factura Inputsoft septiembre 2026
Cartola/adquirente agosto-septiembre

Proposal:
Mercado Pago quote checked DD/MM/YYYY
TV quotation
Mini-PC quotation
~~~

These notes remain on the local presentation device with the calculator inputs.

## Important limitations

The calculator is an operational estimate.

A single average commission is a simplification. A later version can split:

- debit;
- credit;
- prepaid;
- installment costs;
- effective VAT treatment;
- settlement timing.

No tax/accounting conclusion is generated.

## Local persistence

Draft proposal inputs are stored locally under:

~~~text
orbi-pos:modernization-proposal
~~~

They are not part of the shared product catalog and are not sent to the TV Showcase.
