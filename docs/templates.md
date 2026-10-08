# Adding a template

A template is a `Template` object in `packages/core/src/templates/`. It has:

- `params` — fields shown in the studio (brand, theme, currency, paper…)
- `build(params)` — returns a `SpreadsheetSpec` or `PrintableSpec` (plain JSON)
- `seed(params)` — raw material for listing copy: name, format, audience, keywords (≥13), features, includes, how-it-works
- `suggestedPriceUsd`

Register it in `templates/index.ts`. The tests automatically generate it, open the files, and check the listing passes Etsy's rules.

## Spreadsheet formulas

Write formulas with placeholders instead of cell addresses:

| Placeholder | Means | Example |
|---|---|---|
| `[key]` | same-row cell in this table | `N([hours])*N([rate])` |
| `{{Sheet.key}}` | the whole data column of a table | `SUM({{Expenses.amount}})` |
| `{label}` | the category label in a breakdown row | `SUMIF({{Spending.category}},{label},{{Spending.amount}})` |
| `C4`, `C5`… | earlier metrics on a summary sheet (first metric is `C4`) | `C4-C5` |

Formula columns should return `0` (not `""`) for empty rows — zeros are hidden by the number format, and `SUMPRODUCT` stays safe.

## Verify against a real spreadsheet engine

```bash
npm run samples
soffice --headless --calc --convert-to xlsx --outdir /tmp/recalc packages/core/samples-out/*/*.xlsx
```

Then add the recalculated summary values to the "preview evaluator matches LibreOffice" test, which keeps previews, mockups and the real file in agreement.
