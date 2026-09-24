# OC-06 — Safe Catalog CSV Import / Export

## Goal

Make it practical to load El Chunchito's real catalog once the product list becomes available.

Typing dozens of products manually should not be required.

## CSV columns

```text
code
name
category
price_clp
unit
plu
image_url
promo_text
show_on_showcase
featured
active
sort_order
```

Required fields:

- `code`
- `name`
- `category`
- `price_clp`
- `unit`

Supported units:

- `KG`
- `UNIT`
- `PACK`

## Safety model

Import is a **merge by customer-facing code**.

It never deletes an existing product merely because that product is absent from the CSV.

Before anything is written, ORBI produces a preview with:

- new products;
- updated products;
- unchanged products;
- rejected rows.

If any row is rejected, the import cannot be applied until the file is corrected.

## Validation

The importer rejects:

- missing required fields;
- unknown categories;
- prices that are not positive integer CLP values;
- invalid units;
- invalid PLUs;
- repeated product codes inside the CSV;
- PLUs that would be duplicated in the resulting catalog.

PLUs are always treated as strings, so leading zeroes such as `0047` survive export/import.

## Optional-field behavior

Blank optional values are conservative:

- blank PLU preserves an existing PLU;
- blank image URL preserves an existing image URL;
- blank promo text preserves existing promo text;
- blank boolean fields preserve existing values where available.

## Tools

The Products screen now provides:

- **Exportar catálogo**
- **Plantilla CSV**
- **Importar CSV**

The import preview must be explicitly accepted before the shared catalog is updated.

## Why this matters for field work

When Diana provides a list, export, spreadsheet or manually photographed table, it can be transformed into this CSV contract and loaded into ORBI in one controlled operation instead of editing source code.
