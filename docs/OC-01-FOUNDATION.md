# OC-01 — ORBI POS Foundation

## Purpose

Create a safe, original-code foundation for the first ORBI POS pilot at Carnicería El Chunchito.

## Why this is not a fork

The external reference repository `FaustinoDuran/carniceria-pos` contains useful architectural ideas, but no repository-level reuse license has been confirmed. OC-01 therefore implements the pilot with original code while preserving only general software concepts that are not source-code copying.

## Pilot workflow

1. Open ORBI POS.
2. Select a visual category.
3. Select a product.
4. Enter weight or quantity.
5. Add the product to the current sale.
6. Select payment method.
7. Complete the sale.
8. See today's accumulated sales.

## Real pilot seed

The first seed data comes from an El Chunchito DIGI RM-60 receipt:

- Pernil — CLP 4,898/kg; 1.146 kg -> CLP 5,610.
- Orejas y corazón — CLP 4,800/kg; 2.106 kg -> CLP 10,110.
- Receipt total -> CLP 15,720.

The RM-60 evidence shows line totals rounded to the nearest CLP 10, so the pilot calculation engine currently mirrors that behavior. This rule is isolated in `roundMoney()` so it can be changed later if the business confirms a different rule for other payment flows.

The receipt is a reference for the pilot only and is not stored in this public repository.

## Deliberate exclusions

OC-01 does not:

- issue tax documents;
- connect to SII;
- connect automatically to the RM-60;
- manage inventory;
- manage suppliers;
- expose AI functionality.

## Next gate

OC-01 is complete when:

- the web app builds;
- product/category navigation works;
- weight entry produces a subtotal;
- cart totals work;
- payment selection works;
- a completed sale persists locally;
- today's summary updates after checkout;
- the known RM-60 receipt arithmetic is reproduced by automated tests.

After that, the next milestone is **OC-02 — Visual Catalog & Product Administration**.
