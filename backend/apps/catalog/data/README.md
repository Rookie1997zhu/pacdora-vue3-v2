# Catalog seed data

`shipping_presets.json` is generated from LAB `src/catalog/presets.js` (+ KO labels).

```bash
npm run catalog:export-shipping-seed
python manage.py seed_catalog
```

Do not hand-edit the JSON; re-export after preset changes.
