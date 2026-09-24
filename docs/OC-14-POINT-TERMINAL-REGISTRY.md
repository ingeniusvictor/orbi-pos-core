# OC-14 — Point Terminal Registry

## Goal

Prepare ORBI for the future Point Smart 2 before the physical device is purchased or associated.

## Current registry

The server owns the terminal configuration and the browser receives only safe metadata:

~~~text
provider
terminal id
label
Mercado Pago store id
Mercado Pago POS/cashbox id
operating mode
ready/not ready
primary terminal flag
~~~

## Development mode

Default:

~~~text
ORBI_PAYMENT_PROVIDER=mock
~~~

ORBI exposes a clearly identified simulator:

~~~text
Point Smart 2 - Simulador ORBI
terminal: MOCK_POINT_SMART_2
mode: MOCK
~~~

This is not a real Mercado Pago terminal and cannot move money.

## Future production configuration

After a real Point is associated to the business:

~~~text
ORBI_PAYMENT_PROVIDER=mercadopago
MERCADO_PAGO_ACCESS_TOKEN=<server secret>
ORBI_POINT_TERMINAL_ID=<real terminal id>
ORBI_POINT_STORE_ID=<real Mercado Pago store id>
ORBI_POINT_POS_ID=<real Mercado Pago POS/cashbox id>
~~~

Mercado Pago currently requires an integrated Point terminal to be associated to a store and POS/cashbox and configured in PDV mode for attended POS operation.

Official references:

- https://www.mercadopago.cl/developers/es/docs/mp-point-v2/configure-terminal
- https://www.mercadopago.cl/developers/es/reference/in-person-payments/point/terminals/get-terminals/get

## ORBI payment center

The admin UI now has a **Pagos** section showing:

- active provider;
- primary terminal;
- operating mode;
- store and cashbox identifiers;
- readiness state;
- recent payment orders;
- approved/pending/failed counts.

No Access Token is exposed in this interface.
