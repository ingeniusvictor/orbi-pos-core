# OC-05 — Showcase Content Engine

## Goal

Turn ORBI Showcase into a TV-ready presentation surface, not just a static catalog.

## Behavior

The full-screen `/showcase` route now builds a presentation automatically from the shared master catalog.

It creates:

1. one hero slide for every product marked **Destacado**;
2. product-board slides containing up to six visible products each.

If no product is marked Destacado, the first visible product becomes the fallback hero.

## Rotation

Full-screen Showcase rotates automatically every 8 seconds.

Rotation pauses automatically when the browser reports `prefers-reduced-motion`.

The embedded admin preview does not auto-rotate; its navigation dots can be used to inspect each generated slide manually.

## Product presentation metadata

The product master now supports:

- `showOnShowcase`
- `featured`
- `sortOrder`
- `imageUrl`
- `promoText`

These values travel through the same shared catalog synchronization introduced in OC-03.

## Content management

The Showcase admin view includes a dedicated **Contenido TV** workspace where the operator can:

- show/hide a product on the TV;
- mark multiple products as rotating hero features;
- change presentation order;
- assign a premium image URL;
- add a short promotional label.

Changes are staged locally and sent to the shared catalog only when **Guardar contenido TV** is pressed.

## Design rule

Customer-facing product codes remain visually prominent on both hero and board slides.

The intended customer workflow is:

```text
see product -> read code -> ask for code -> staff selects/weighs product
```

## Data integrity

OC-05 does not add unverified El Chunchito products, prices or PLUs. Content controls only change presentation metadata around the existing master catalog.

## Next visual step

Once real products are known, premium product photography or ORBI-generated promotional imagery can be assigned through `imageUrl` without changing the catalog architecture.
