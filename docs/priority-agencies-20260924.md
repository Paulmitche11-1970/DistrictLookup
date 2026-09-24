# Six priority agency previews — September 24, 2026

All six use one published agency record across Classic, Concierge, Explorer and Presentation. Each has its own scoped administration, map, real public address dataset, current roster, portraits, logo, four layout screenshots and a read-only administration screenshot. Listed as **In progress**, pending agency review rather than resident launch approval.

| Agency / route | Areas | Officials | Searchable public addresses |
|---|---:|---:|---:|
| San José–Evergreen CCD `/san-jose-evergreen` | 7 | 7 | 212,737 |
| Barstow CCD `/barstow-college` | 5 (A–E) | 5 | 21,928 |
| Placer Union HSD `/placer-union-high-school` | 5 | 5 | 36,443 |
| California City `/california-city` | 4 | 5 | 5,248 |
| Olivenhain MWD `/olivenhain-water` | 5 | 5 | 25,805 |
| Galt `/galt` | 5 | 5 | 9,550 |

Total: 32 officials and 311,711 address records. Per-agency `provenance.json` records sources, source checks, GIS methods, asset hashes, and outstanding confirmation. Only public situs/site addresses were imported; no owners, voter records, or private household fields. Address points are approximate, and source coverage may omit newer buildings or units. SJE uses public situs fields in RP's final parcel package; Barstow uses San Bernardino County site addresses; Galt uses Sacramento County public situs parcels; Olivenhain uses SanGIS/SANDAG address points; Placer Union and California City use public DWR/LightBox situs parcels. No internal-only Placer County layer was imported.

## Important source decisions

- **Barstow:** the RP saved final shapefile's area C contains a large rectangular discrepancy. The lookup instead uses the current agency-linked RP web geometry verified against the adopted PDF. Areas A/B/D/E match. The original boundary-library source is preserved and flagged `imported-needs-review`; do not silently replace the verified lookup with that shapefile.
- **California City:** the saved adopted 2025 shapefile exactly matches the city's currently linked map. A different March 2026 county-compliant version exists in RP files. Confirm which is now legally operative with the agency before replacing the public-linked version.
- **SJECCD:** retain the valid adopted Plan D5 shapefile. The current web rendering differs slightly and has overlapping slivers; the PDF supports D5. Valid isolated point contacts between multipart polygons and between shell/hole rings are preserved by the corrected topology validator. Crossings, shared segments, overlapping interiors and disconnected polygon interiors still fail validation.
- **Placer Union:** areas 1 and 5 have district representatives; continuing officials associated with areas 2, 3 and 4 serve at large until their district transition. Carleton Copa's September 10, 2026 appointment replaces Tom Duncan in area 5. Confirm interim Emerson Lake's at-large interpretation with the agency.
- **Galt and California City:** current members remain at large during the staggered district transition. A matched district does not prematurely convert a continuing incumbent into a district representative. No automatic change at election day.
- Term years are preserved when a source gives only a year. The admin editor accepts `2028` or `2028-11`; no invented month is needed.
- Several official source portraits are low-resolution. They were not retouched or generated; higher-resolution originals can be supplied by the agency.

## Agency introduction and sending links

The design gallery opens a dismissible, session-scoped welcome explaining hosted links, embeds, editable information and visibility preferences, four layouts, and requests for changes. Pricing follows the latest user instruction: **free until July 1, 2027; then $75/month or $900/year**. Opening a preview does not create an account, subscription, invoice or billing enrollment.

Every available agency has a **Sending Link** in `/admin` and in the RP staff view of its gallery. Copy the complete link. It grants only that agency's published gallery and read-only administration preview, without an individual login or password. Recipients see no All agencies navigation or agency chooser; RP Data branding opens the public `https://rpdata.net` website. Public resident lookup routes remain public by design. Existing RP-only directory, boundary library and logs remain protected; client editing still requires independent MFA.

Sending links contain purpose-separated HMAC credentials, never APP_SECRET or client credentials. The entry route validates the exact agency, sets an HttpOnly agency-path cookie and redirects to the clean gallery URL, with no-store/no-referrer headers. Links remain stable across deployments when APP_SECRET and agency revision remain unchanged. To revoke only one agency's link, change `AGENCY_PREVIEW_REVISION_<SLUG_UPPER_UNDERSCORES>` to a new value and redeploy; then copy its new Sending Link. This also invalidates previous preview cookies. Do not rotate APP_SECRET solely to revoke a preview: it also protects existing administrator secrets.

RP Data now has Home, What We Do, About Us and My District pages, including the four named team members. Host-specific rewrites serve these at rpdata.net and www.rpdata.net, with /rpdata routes retained on wheresmydistrict.com. Cloudflare CNAME and verification TXT records point both new hosts to the existing Railway service. Website contact links use the existing published RP business email; no rpdata.net mailbox is implied. Redistrictingpartners.com itself is unchanged. No agency email has been sent. Separate real-agency setup credentials have not been provisioned as part of this release; preview links never substitute for those credentials. No existing production drafts are published or overwritten by this release.

## Validation

- 81 unit tests passed, including all new address-to-district assignments, topology regressions, representation transitions and sending-token scope/revocation.
- 216 priority-agency HTTP checks passed: actual address matches, independent MFA, draft/publish, shared four-layout content, and tenant isolation in disposable local databases.
- 237 sending-link HTTP checks across all 18 available agencies passed, including galleries, RP tools, unpublished previews, read-only admin and denied write APIs. RP staff retain sandbox editing even after opening a Sending Link.
- 19 administration routing checks passed.
- Lint, TypeScript and production build passed.
- Browser review covered all 30 new layout/admin screenshots; the welcome was centered on desktop and usable at 390px wide without horizontal overflow. Session dismissal and reopen worked. Recipient gallery navigation contained no root link. `/rpdata` was reviewed at desktop and mobile widths.

Source work and visual QA remain in the workspace's `work/agency-expansion/priority-sep24` and `outputs/priority-agencies-sep24`. Those contain source originals; only optimized production assets and required source audits are committed.
