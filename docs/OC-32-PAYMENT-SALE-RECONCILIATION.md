# OC-32 — Payment-to-Sale Reconciliation & Orphan Recovery

## Goal

OC-31 guarantees that a normal card checkout does not close until both:

1. Payment Core reaches `processed`; and
2. the authoritative sale is persisted in `sales.json`.

OC-32 protects the remaining crash/restart edge case: Payment Core can be durable
while the browser that still held the cart disappears.

The safety principle is:

~~~text
processed payment + no sale
        =
DO NOT CHARGE AGAIN
recover the missing sale
~~~

## Provider-free reconciliation

The server exposes:

~~~text
GET /api/stores/<storeId>/payments/reconciliation
~~~

The endpoint reads only:

- `PaymentStore` / `payments.json`;
- `SaleStore` / `sales.json`.

It does not call Mercado Pago or any other payment provider.

The response explicitly carries:

~~~text
providerCallsMade: false
~~~

## States

Each retained Payment Core order is classified as one of:

### linked

A sale references the ORBI Payment Core order ID.

This is the expected completed-card state.

### orphan_processed

The order is locally recorded as `processed` but no authoritative sale
references it.

This is the critical OC-32 recovery condition.

### refunded_after_sale

A sale exists and remains immutable, while Payment Core now records the linked
order as `refunded`.

OC-32 surfaces the discrepancy for operational follow-up. It does not rewrite or
delete the historical sale.

### unlinked_nonprocessed

No sale references the order and the order is not `processed`.

Examples include pending, failed, canceled, expired or action-required attempts.

## Recovery from Pagos

The Payment Center shows reconciliation status beside every retained order.

For `orphan_processed`, **Recuperar venta** opens:

~~~text
/?view=sale&recoverPayment=<ORBI_PAYMENT_ORDER_ID>
~~~

The recovery view rechecks the order through the provider-free reconciliation
endpoint before enabling recovery.

If the order has already become linked, or is no longer a recoverable processed
orphan, ORBI blocks recovery.

## Lost-cart rule

OC-32 intentionally does not reconstruct sale lines automatically.

A payment amount alone is insufficient evidence of which products, weights and
prices were sold.

The operator must rebuild the cart from available operational evidence.

This prevents a payment total from being silently converted into invented sale
content.

## Locked recovery behavior

While recovery mode is active:

- payment method is locked to the original debit/credit method;
- no Point dialog opens;
- no new Payment Core order is created;
- the provider is not queried;
- expected total is the original Payment Core amount;
- registration stays disabled until the reconstructed cart total matches exactly.

## Stable recovery idempotency

Recovery derives:

~~~text
recover_<ORBI_PAYMENT_ORDER_ID>
~~~

as the sale `clientRequestId`.

The same orphan therefore produces the same sale idempotency key across reloads
and retries.

If a POST response is lost after `sales.json` was written, the payment becomes
`linked` on the next reconciliation and cannot be recovered again as an orphan.

## Server authority remains unchanged

Recovery still uses the normal OC-31 sale endpoint.

The server verifies:

- Payment Core order exists;
- status is `processed`;
- total equals the reconstructed sale;
- requested debit/credit method matches;
- provider matches;
- provider order ID matches;
- external reference matches;
- terminal matches;
- the payment is not already linked to another sale;
- line validation and CLP-10 rounding pass.

The browser cannot override those checks.

## Retention-window hardening

OC-32 also fixes the Payment Core list limit path so the requested limit reaches
`PaymentService`, and raises the PaymentStore read cap to the full retained
1,000-order window.

This lets reconciliation inspect the same complete Payment Core history currently
retained by the pilot.

## Safety boundaries

OC-32 does not:

- perform a second card charge during recovery;
- call a provider from reconciliation;
- infer products from a payment total;
- edit/delete a completed sale;
- issue SII documents;
- write to DIGI RM-60 scales.

## Acceptance

- local PaymentStore↔SaleStore reconciliation;
- explicit orphan-processed detection;
- linked/refunded/unlinked classification;
- Payment Center warnings and linked-sale visibility;
- recovery route from an orphan payment;
- exact-total lock;
- deterministic recovery client request ID;
- original payment trace reuse;
- OC-31 server validation remains authoritative;
- tests/build green.
