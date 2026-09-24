# OC-10 — Price Change Safety & One-Step Rollback

## Goal

Keep price changes extremely fast while giving El Chunchito a simple safety net when a price batch is entered incorrectly.

## Batch behavior

Every save from **Precios** already writes all changes with the same timestamp.

OC-10 treats that timestamp as one price operation.

Example:

~~~text
24/09 16:10
Pernil              4.898 -> 5.190
Costillar            6.490 -> 6.990
Pulpa                 7.990 -> 8.290
~~~

The UI now presents that as one latest operation rather than requiring the operator to reverse each product manually.

## Undo

**Deshacer última operación** is a two-step action:

1. request undo;
2. explicitly confirm it.

The rollback restores each affected product to its previous price and records the restoration as a new append-only history batch.

History is not deleted or rewritten.

## Newer-price guard

A rollback only touches a product when its current price still matches the price produced by the operation being undone.

If another device or later process already changed that product again, ORBI skips it instead of overwriting the newer price.

Example:

~~~text
Original:        4.898
Batch changed:   5.190
Later changed:   5.290

Undo old batch:
-> ORBI keeps 5.290
-> product is reported as skipped
~~~

This is important once more than one administration device can use the shared catalog.

## Scope boundary

OC-10 is a price-operation safety feature. It does not replace:

- server catalog revision conflict protection;
- RM-60 backup/recovery;
- tax-document correction;
- inventory audit.
