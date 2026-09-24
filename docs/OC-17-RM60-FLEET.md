# OC-17 — Four DIGI RM-60 Fleet Registry

## Goal

Represent the real weighing topology currently known at Carnicería El Chunchito without inventing synchronization behavior that has not yet been observed.

## Field facts confirmed by staff

- the shop has four DIGI RM-60 scales;
- all four are described as the same model;
- the photographed unit is described as the principal scale;
- staff currently update prices from that principal scale.

These are operational observations from the shop, not proof of a specific network protocol or master/slave implementation.

## What remains unknown

ORBI deliberately keeps these items as pending:

- whether RM60-01 pushes prices/products automatically to the other three scales;
- whether each scale keeps an independent copy of the product catalog;
- serial numbers;
- LAN/IP addresses;
- physical placement of every unit;
- current communication path between scales;
- any DIGI management software/middleware;
- supported write/import protocol.

## Registry

The Balanza section now contains four device records:

~~~text
RM60-01  principal
RM60-02  secondary
RM60-03  secondary
RM60-04  secondary
~~~

Each scale can store:

- serial number;
- IP address;
- physical location;
- connectivity observation;
- field notes.

The fleet itself has a separate synchronization-behavior field:

~~~text
unknown
independent
principal_distributes
~~~

The default is always `unknown`.

## Separation from PLU mapping

Device identity and product PLU mapping are intentionally different layers.

~~~text
Scale fleet
  -> which physical RM-60 devices exist?

Product PLU map
  -> which PLU represents Pernil, Costillar, etc.?
~~~

A product PLU is not tied to one scale until field evidence says otherwise.

## Safe boundary

OC-17 performs **no network probing and no write operation** against any RM-60.

Changing the registry only changes ORBI's documentation of the installation.

A future connectivity milestone may test each IP/device individually, but only after:

1. serial/IP/topology evidence is collected;
2. a current scale backup exists;
3. the supported communication method is confirmed.

## Field checklist

When returning to the shop, collect for every scale:

~~~text
ORBI id:
serial number:
IP shown/configured:
physical location:
same product code visible?:
same price visible?:
what happens after price changes on principal?:
time until other scales change, if they do:
notes:
~~~

The most valuable observation is to change one harmless test price using the shop's existing procedure and watch the other three scales, without ORBI sending any command.
