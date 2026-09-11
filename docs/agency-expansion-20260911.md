# Agency expansion — September 11, 2026

Two new agency packages join the shared four-layout lookup and isolated administration system:

| Agency | Districts | Officials | Searchable public addresses | Portraits |
|---|---:|---:|---:|---:|
| Belmont | 4 | 4 councilmembers + at-large mayor | 7,555 | 5 |
| Mid-Peninsula Water District | 5 divisions | 5 directors | 7,824 | 5 |

Both use RP final original line shapefiles, the `DISTRICT` field, verified current official agency rosters and exported official portraits/logos. All address points must be inside exactly one district and agree with the parcel source's district. Blank/unassigned Belmont geometry is explicitly excluded and documented. Neither map is trimmed or forced contiguous. Address lists are historical public situs parcels, with approximate interior points and a public coverage note. No parcel ownership, voter or demographic fields are retained.

Belmont's current numbered final map is linked on its [city council page](https://www.belmont.gov/departments/meetings-agendas-minutes/council-commissions-committees-boards/city-council). Mid-Peninsula's sources and adoption comparison are recorded in `data/agencies/midpeninsula-water/provenance.json`. Exact legal effective dates were not independently established and remain blank. Agency-specific source records accompany each package.

Fourteen additional official portraits complete all occupied seats in San Mateo, Burlingame and Millbrae. Both missing city seals are included. Millbrae District 3 stays vacant. Frozen source manifest: `docs/sources/portraits-20260911.json`.

The one-time portrait migration fills only an empty photo with a matching official ID, district and normalized name. It preserves existing uploads, changed occupants, every other field, both draft/published states independently and revision numbers. It never publishes an unpublished draft. The transaction and its count-only audit entry are idempotent.

Terminology is shared across layouts: cities retain council labels; special districts use Board of Directors; an immutable instance `districtLabel` supports Division, Zone and Trustee Area. Mid-Peninsula uses Division consistently in public roster/result/map labels.

## Administration activation

The new agencies have separate admin routes and MFA enrollment support. Their review galleries provide read-only administration previews. Before creating a real agency administrator, configure independent random `ADMIN_SETUP_TOKEN_BELMONT` and `ADMIN_SETUP_TOKEN_MIDPENINSULA_WATER` values in the existing Railway service. Never reuse Martinez's token, modify `APP_SECRET`, reset the volume or replace existing state. Leaving a token unset blocks setup securely. Tokens are not committed to the repository.

## Validation

- Production geometry tests cover all 15,379 new addresses and each agency's map/roster/source package.
- Whole unit suite: 60 passed; focused portrait migration: 83 checks passed.
- New-agency HTTP suite: 72 checks passed, covering independent setup tokens, MFA, address lookup, draft/publish behavior, all four layouts, biography sharing and tenant isolation on disposable local databases.
- Existing expansion HTTP suite: 174 checks passed.
- Lint, TypeScript and production build passed.
- Actual browser screenshots were refreshed for all five affected agencies. No mock screenshots are used.

## Held packages and inventory

Petaluma and Santa Rosa have final-map candidates, seven verified officeholders and seven official portraits each, plus logos. They remain unregistered pending public address imports and current GIS boundary comparison. Sequoia Healthcare has 66,934 candidate addresses but remains unregistered pending Zone E roster clarification and current-map comparison. Their candidates are not production payloads.

The workspace inventory at `outputs/agency-expansion-sep11` covers 121 agencies, 119 with complete candidate polygon file packages, and 85 with exact local roster matches. These are source availability counts, not certification of current boundaries or completed sites.
