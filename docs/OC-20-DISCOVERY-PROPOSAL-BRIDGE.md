# OC-20 — Discovery → Proposal Bridge

## Goal

Use the verified commercial baseline captured in **Levantamiento** as the source for the current-system side of the owner modernization proposal.

The operator should not need to type the same current-business cost data twice.

## Source fields

OC-20 reads only the commercial section of the OC-19 discovery record:

~~~text
fixedMonthlyCost
cardAcquirer
cardFeePercent
monthlyCardSales
sunmiArrangement
evidenceNote
~~~

It does not transfer:

- SUNMI/Inputsoft/SII diagnostic conclusions;
- RM-60 topology assumptions;
- credentials;
- cardholder data;
- customer personal information.

## Target fields

The bridge can populate only the current-system proposal fields:

~~~text
currentFixedMonthly
currentCardFeePercent
monthlyCardSales
currentSourceNote
~~~

The proposed-system fields remain independent:

~~~text
proposedFixedMonthly
proposedCardFeePercent
pointDeviceCost
showcaseTvCost
miniPcCost
proposedSourceNote
~~~

## Merge safety

The bridge uses a field-level snapshot of the last imported discovery values.

For each current-system field:

1. if the proposal is empty and discovery contains a valid value, import it;
2. if the proposal still equals the previous imported value, a later discovery update may refresh it;
3. if the proposal differs from the previous imported value, treat it as a manual override and preserve it;
4. if the user intentionally clears a previously imported value, preserve the manual clear;
5. never replace a proposal value with a missing discovery value.

This allows discovery to remain the default source without silently destroying owner/user corrections.

## Evidence note

The bridge builds a readable source note from available operational context, for example:

~~~text
Levantamiento ORBI · Adquirente: Proveedor verificado · SUNMI arrendada · Evidencia: Factura septiembre + cartola
~~~

Only non-sensitive fields from the discovery model are used.

## Automatic refresh

When **Propuesta** opens, OC-20 immediately evaluates the latest local discovery record.

A separate presentation tab also listens for browser storage updates so changes saved from the admin tab can refresh the current-system baseline automatically.

The operator can also press:

~~~text
Actualizar desde Levantamiento
~~~

## Status

The proposal shows one of four bridge states:

~~~text
empty
partial
synced
manual-overrides
~~~

manual-overrides means discovery was checked but one or more current-system proposal fields were intentionally preserved because they no longer matched the prior imported snapshot.

## Persistence

The existing proposal remains stored at:

~~~text
orbi-pos:modernization-proposal
~~~

The bridge snapshot is stored separately at:

~~~text
orbi-pos:proposal-bridge
~~~

The field discovery remains at:

~~~text
orbi-pos:field-discovery
~~~

No bridge data is published to the product catalog or Showcase.
