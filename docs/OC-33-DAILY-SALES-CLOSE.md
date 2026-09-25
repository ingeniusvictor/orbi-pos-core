# OC-33 — Daily Sales Close & Reconciliation Snapshot

## Goal

Create an immutable daily operational snapshot from the two durable local sources
introduced before OC-33:

- OC-31 server-authoritative `sales.json`;
- Payment Core `payments.json`.

The snapshot answers what ORBI itself knows about one business date without
claiming to reconcile physical cash, bank balances or SII.

## Business timezone

The default El Chunchito business timezone is:

~~~text
America/Santiago
~~~

The server can override it with:

~~~text
ORBI_BUSINESS_TIME_ZONE=<IANA timezone>
~~~

Calendar-day assignment is performed on the server with the configured IANA
timezone, not by assuming UTC.

## Preview API

~~~text
GET /api/stores/<storeId>/daily-close/preview?date=YYYY-MM-DD
~~~

If `date` is omitted, ORBI uses the current business date in the configured
timezone.

The preview reads local stores only and explicitly reports:

~~~text
providerCallsMade: false
~~~

## Preview contents

For the selected business date:

- sale count;
- total CLP;
- count/total for cash;
- count/total for debit;
- count/total for credit;
- count/total for transfer;
- linked card sales;
- processed payment orders without a sale;
- linked sales whose Payment Core order is now refunded;
- card-sale linkage/status mismatches;
- status;
- warnings;
- source SHA-256 fingerprint.

## Status

### reconciled

No local payment/sale discrepancy is detected inside the OC-33 scope.

### attention_required

At least one of these conditions exists:

- a `processed` Payment Core order created on the business date has no sale;
- a card sale from that business date has a linked order now marked
  `refunded`;
- a card sale cannot be matched to a compatible local Payment Core state.

This status is deliberately local. It does not query Mercado Pago.

## Immutable close

~~~text
POST /api/stores/<storeId>/daily-close
Content-Type: application/json

{
  "date": "YYYY-MM-DD"
}
~~~

Persistent file:

~~~text
stores/<storeId>/daily-closes.json
~~~

Each record includes:

- immutable close ID;
- store ID;
- business date/timezone;
- revision;
- creation timestamp;
- exact preview totals;
- reconciliation summary;
- status/warnings;
- SHA-256 source fingerprint;
- optional previous-close reference;
- append-only creation audit event.

There is no edit or DELETE endpoint.

## Fingerprint and revisions

The fingerprint is deterministic over relevant sales and payment state.

If the latest close for the date has the same fingerprint, repeating POST returns
that existing close instead of creating a duplicate.

If the ledger/payment state changed, a new revision is appended:

~~~text
revision 1 -> immutable
revision 2 -> immutable, supersedes revision 1
revision 3 -> immutable, supersedes revision 2
~~~

Older revisions remain available for audit.

## UI

Open:

~~~text
/?view=close
~~~

The screen shows:

- business date selector;
- local reconciliation state;
- total/count;
- payment-method breakdown;
- card reconciliation counters;
- warnings;
- source fingerprint;
- immutable revision history.

## Explicit accounting boundary

OC-33 does not prove:

- how much physical cash is inside the drawer;
- whether a bank transfer arrived;
- whether card settlement reached the bank;
- whether accounting books reconcile;
- whether SII declarations/documents reconcile.

Those require separate evidence/integrations.

## Safety

OC-33 does not:

- call Mercado Pago during preview or close;
- create/cancel/refund payments;
- modify completed sales;
- issue SII documents;
- write to DIGI RM-60 devices.

## Disaster recovery

`daily-closes.json` is part of OC-29 server disaster recovery and is validated
by OC-30 isolated recovery certification.

## Acceptance

- business-timezone-aware day assignment;
- exact method totals;
- provider-free reconciliation;
- attention state for orphan/refund/mismatch;
- deterministic fingerprint;
- idempotent same-state retry;
- append-only revision after drift;
- Cierre UI;
- OC-29/OC-30 coverage;
- tests/build green.
