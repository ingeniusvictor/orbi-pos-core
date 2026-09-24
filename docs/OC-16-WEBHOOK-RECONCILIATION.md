# OC-16 — Mercado Pago Webhook Relay & Reconciliation

## Goal

Prepare ORBI for reliable Point payment reconciliation without exposing the shop LAN server directly to the public internet.

## Important architecture boundary

The current ORBI server listens on the shop LAN.

It must **not** be used as the public Mercado Pago Webhook endpoint.

Target architecture:

~~~text
Mercado Pago
    |
    | HTTPS Webhook
    v
Public ORBI Payment Relay
    |
    | durable authenticated event channel
    v
ORBI POS in the shop
    |
    | GET /v1/orders/{providerOrderId}
    v
Mercado Pago authoritative order state
~~~

The Webhook is a signal that an order changed. ORBI does not trust the Webhook body alone as proof that a payment succeeded.

## Mercado Pago signature verification

The repository now contains a reusable verifier for the documented `x-signature` contract.

For Point order notifications:

~~~text
x-signature: ts=<timestamp>,v1=<hex HMAC>
x-request-id: <request id>
data.id: <provider order id>
~~~

ORBI builds:

~~~text
id:<lowercase data.id>;request-id:<x-request-id>;ts:<ts>;
~~~

and calculates:

~~~text
HMAC-SHA256(webhook_secret, manifest)
~~~

The calculated hexadecimal signature is compared to `v1` using a constant-time comparison.

For Point order notifications Mercado Pago documents that `data.id` must be lowercased during signature validation.

## Supported Point order notifications

The current contract recognizes:

~~~text
order.processed
order.canceled
order.refunded
order.action_required
order.failed
order.expired
~~~

Unknown actions are rejected by the normalizer instead of silently changing payment state.

## action_required

Mercado Pago currently documents `action_required` / `check_on_terminal` as a state that requires checking the terminal.

ORBI therefore:

- does not mark the sale as paid;
- stops normal automatic checkout completion;
- shows **Revisar terminal**;
- keeps the order in the audit trail.

Only `processed` closes a card sale automatically.

## Authoritative reconciliation

The LAN Payment Core now supports reconciliation by provider order id.

Future relay flow:

~~~text
1. Relay receives and validates webhook.
2. Relay deduplicates event.
3. Shop ORBI obtains provider order id from relay.
4. ORBI locates the matching local payment.
5. ORBI calls Mercado Pago GET /v1/orders/{id}.
6. ORBI persists the state returned by Mercado Pago.
~~~

This protects against:

- forged webhook bodies;
- duplicate webhook delivery;
- stale webhook data;
- an interrupted browser session.

## Current implementation boundary

OC-16 does **not** deploy the public relay yet.

The repository now contains:

- HMAC verifier;
- Point-order webhook normalizer;
- tests for signature tampering and uppercase Point order ids;
- `action_required` handling;
- provider-order lookup;
- authoritative provider reconciliation endpoint.

The public relay requires a durable cloud store/queue and HTTPS deployment. That should be activated only when a real Mercado Pago application and Point terminal are available.

## Official Mercado Pago references

- https://www.mercadopago.cl/developers/es/docs/mp-point-v2/notifications?scope=prod
- https://www.mercadopago.cl/developers/en/docs/mp-point/notifications?scope=prod
- https://www.mercadopago.cl/developers/es/docs/mp-point-v2/resources/status-order-transaction?scope=prod
- https://www.mercadopago.cl/developers/es/reference/in-person-payments/point/orders/get-order/get

## Security rules

- never expose the local ORBI port directly to the public internet;
- never place Mercado Pago Access Tokens or Webhook secrets in the browser;
- validate signature before accepting a public event;
- do not mark a sale paid from Webhook body status alone;
- query the authoritative provider order before irreversible local actions.
