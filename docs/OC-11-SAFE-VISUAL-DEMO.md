# OC-11 — Safe Visual Demo Mode

## Goal

Provide a presentation-ready ORBI Showcase before the real El Chunchito catalog is available, without mixing illustrative information into the operational catalog.

## Route

The visual demo is available at:

~~~text
/showcase-demo
~~~

The real customer-facing TV remains:

~~~text
/showcase
~~~

## Isolation

The demo route uses a source-code-only catalog containing six illustrative products.

It does **not**:

- read the real master catalog for presentation content;
- publish demo products to the sync server;
- modify local product storage;
- create price history;
- assign RM-60 PLUs;
- mark demo data as verified El Chunchito data.

The route is resolved before the operational application is mounted, so the demo does not start catalog synchronization or persistence hooks.

## Visual marking

The demo always shows a permanent top banner:

~~~text
DEMO VISUAL · PRECIOS ILUSTRATIVOS · NO CORRESPONDEN AL CATÁLOGO REAL
~~~

Demo customer codes are also prefixed with D:

~~~text
D101
D102
...
~~~

This makes screenshots and in-person demonstrations less likely to be confused with current store pricing.

## Demo content

The six presentation examples are:

- Pernil
- Costillar
- Lomo vetado
- Pulpa
- Asado carnicero
- Carne molida

Their prices and codes are illustrative only.

## Purpose

This route lets the owner see the complete ORBI Showcase behavior now:

- rotating hero slides;
- product-board slide;
- large prices;
- large customer codes;
- promotional labels;
- kiosk controls and full-screen behavior.

Once the real catalog is available, /showcase continues to use only the verified/shared master catalog.
