# OC-04 — DIGI RM-60 PLU Discovery & Mapping

## Goal

Prepare ORBI POS to understand the **real** product coding already used by the DIGI RM-60 without writing anything to the scale yet.

This milestone is intentionally read/document/map first.

## Important distinction

ORBI keeps two identifiers separate:

- **Customer code**: the short code shown on ORBI Showcase, for example `101`.
- **RM-60 PLU**: the actual identifier programmed in the DIGI scale, which is still unknown for most products.

They may eventually be the same, but ORBI does not assume that.

Example:

```text
Customer sees: COD 101
        |
        v
ORBI product: Pernil
        |
        v
RM-60 PLU: 0047   <- example only, not confirmed
```

## New mapping workspace

The **Balanza** section allows the pilot team to:

- see every active ORBI product;
- see its customer-facing code;
- see its ORBI price;
- record the real RM-60 PLU when discovered;
- identify products still pending;
- prevent duplicate PLUs;
- preserve leading zeroes such as `0047`;
- export the current mapping to CSV for field comparison.

Saving PLU mappings updates the same shared catalog used by ORBI POS and Showcase.

## Safe operating rule

OC-04 does **not** send commands, products or prices to the RM-60.

Before any write integration we must confirm:

1. how El Chunchito currently creates/changes PLUs;
2. whether configuration happens on the scale or from PC software;
3. whether the existing system can export PLUs;
4. the supported communication method;
5. how to back up the current scale configuration;
6. how to recover if a write fails.

## Field capture

For each product observed in the current RM-60 workflow collect:

```text
Customer code:
Product:
RM-60 PLU:
Price:
Unit:
Where it was observed:
How the price/product is edited today:
Notes:
```

Photos or screenshots of the product-management screen are more useful than asking non-technical staff for protocol details.

## Known pilot data

The supplied receipt confirms these product names and prices, but **not their PLUs**:

- Pernil — CLP 4,898/kg.
- Orejas y corazón — CLP 4,800/kg.

No PLU is marked as verified until it is observed directly in the scale/software configuration.

## Exit criteria

OC-04 discovery is ready to move toward an integration bridge when:

- the main El Chunchito product list is mapped;
- PLUs are confirmed from real evidence;
- the configuration path is documented;
- export/import or communication capabilities are identified;
- a backup/recovery procedure is known.

Only then should a later milestone consider **Publish prices to RM-60**.
