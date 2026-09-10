# District Lookup — Martinez pilot

A working Redistricting Partners demonstration of an agency-owned representative lookup and administration portal. This pilot uses Martinez; it does not create or manage multiple agency accounts.

## Resident experience

- Address suggestions from 13,882 county address points inside the district polygons; outside-city postal addresses are excluded.
- Server-side point-in-polygon assignment, address marker, district highlight, portrait, official email, shared council office phone, biography link and term end.
- Street and satellite map views, district browsing, citywide mayor, responsive layout, keyboard-operated search and a text answer alongside the map.
- `/` is **RP Data Voter Lookup Instances**, grouped by agency type. Martinez is the only published instance; empty categories do not imply other agencies are ready.
- `/martinez` (also `/Martinez`) presents four working designs with actual page screenshots, plus an administration preview.
- `/martinez/classic` keeps the original side-by-side layout; `/martinez/concierge` emphasizes the address and answer; `/martinez/explorer` uses a full map and floating detail card; `/martinez/council` integrates a portrait directory.
- All four use the same lookup hook, representative/contact components, published data and map. `/embed?design=classic|concierge|explorer|directory` supports each layout; `/embed` defaults to Classic. The admin embed panel supplies design-specific links and iframe code.
- `/martinez/administration` is a read-only version of the actual administration component. It receives only `publicContent()` and an aggregate address count. It does not load private account data, activity or drafts, and cannot upload, save, publish or change security settings. `/admin` remains protected by password and TOTP.

## Agency administration

`/admin` requires a password and authenticator TOTP. Initial setup requires a random deployment setup token. Passwords use salted scrypt, TOTP secrets are encrypted with AES-256-GCM, sessions are hashed and stored server-side, and recovery codes work once. Mutations validate same-origin requests and credential attempts are rate-limited.

Edit official names, titles, photos, contact information, staff contacts, term dates and vacancies. Switch optional public fields on or off, edit introductory text and copy website embed code. Upload JPG, PNG or GIF portraits; images are decoded, stripped of metadata and stored as WebP. Animated GIFs use the first frame.

Upload zipped shapefiles or polygon GeoJSON, explicitly select the district field, review the preview and save a draft. The server validates coordinate ranges, rings, self-intersections, duplicate district labels and overlapping districts. A replacement must retain coverage of at least 99.5% of the pilot address inventory. Duplicate feature rows must first be dissolved by district; multipart polygons and holes are supported. City annexations or significant coverage changes require a GIS/address-data refresh outside this pilot UI.

Saved edits remain drafts until **Publish changes**. Draft preview is authenticated and supports `?design=classic|concierge|explorer|directory`. Concurrent edits return a conflict instead of overwriting newer changes. The history records edits, publication and security events. Unpublished uploaded portraits are only served to an authenticated administrator. Display-hidden contact fields are omitted from the public page payload.

## Run locally

Use Node 24 and npm. Run `npm ci`, copy `.env.example` to `.env.local`, generate independent random values for `APP_SECRET` and `ADMIN_SETUP_TOKEN`, then `npm run dev`. Open `http://localhost:3000`.

Set up the first administrator at `/admin/setup`, enter the deployment setup code, choose your own password, scan the QR code with an authenticator app and save the recovery codes. Setup closes after the first administrator exists. Keep `APP_SECRET` stable and backed up: changing it invalidates the ability to decrypt existing authenticator secrets. Remove `ADMIN_SETUP_TOKEN` from deployment variables after enrollment.

## Railway

Deploy the included Dockerfile to the user's DistrictLookup Railway project. Attach a persistent volume at `/data` and use exactly one replica. Required variables:

| Variable            | Value                                          |
| ------------------- | ---------------------------------------------- |
| `DATA_DIR`          | `/data`                                        |
| `APP_URL`           | The exact HTTPS origin, with no path           |
| `APP_SECRET`        | At least 32 random characters; retain securely |
| `ADMIN_SETUP_TOKEN` | A separate random setup token                  |
| `PORT`              | `3000` (match the domain target port)          |

The database and uploaded photos live on the volume. Container redeployment preserves them. The health endpoint is `/api/health`. Seeds initialize only an empty database, so deploying new code does not reset agency edits. Use Railway volume backups and retain the encryption key separately; a recovery needs both the data and key. Do not run several application replicas against this SQLite volume. Multiple administrators, organization provisioning, SSO, billing and fleet-wide operations are future scope.

The app is marked as an RP demonstration and excluded from search indexing. Deployment alone does not make it an official City of Martinez service. The iframe can be embedded by an agency's website administrator; admin pages cannot be framed.

## Data provenance and refresh

- Boundaries: RP's **City of Martinez Final Map 2022.shp**, field **DISTRICT**, districts 1–4; one unassigned record excluded. Adopted April 6, 2022. `data/districts.json` preserves the actual geographic geometry.
- Officials and portraits checked September 9, 2026 against the [City of Martinez council page](https://www.cityofmartinez.org/government/mayor-and-city-council). Portrait source links and details are in `data/provenance.json`. Contact phone is the shared council office number.
- Addresses: Contra Costa County's [GIS address download](https://gis.cccounty.us/Downloads/General%20County%20Data/CCC_DOIT_AddressData.zip), snapshot **October 31, 2025**. Newer addresses may be missing. No global geocoder fallback is used. Exact boundary or ambiguous points are not assigned arbitrarily.
- Street tiles: OpenStreetMap. Satellite imagery: Esri World Imagery. Both remain external services with their own availability, attribution and usage terms. Address lookup works without a geocoding API key; the background imagery still depends on those providers. Before wider commercial rollout, choose an imagery provider/service level and budget appropriate to expected traffic.

`scripts/prepare-pilot.mjs` and `scripts/filter-addresses.mjs` document the initial import. They are offline data preparation tools and require the RP source files; normal application startup only needs the included seed files. Address refresh is currently an operator task, not an admin feature.

## Verification

`npm test` checks every seed address against the polygons, outside and boundary handling, holes/multipart geometry, map rejection, password hashing, TOTP replay, recovery replay, field visibility and bounded request bodies. `npx tsc --noEmit` checks types. `npm run build` creates the production bundle.

For HTTP integration testing after building: run `npm test` to create the test output directory, run `node scripts/start-test-server.mjs` in one terminal, and `node scripts/test-http.mjs` in another. The runner creates a fresh temporary database on localhost port 3001. It verifies setup/MFA, protected routes, CSRF, lookup, photos, draft isolation, publishing, conflicts, map replacement, recovery and password changes without touching the local or deployed administrator. Stop the test server afterwards. Never point these tests at production.

The business offering under discussion remains free agency use until July 1, 2027, followed by $1,200/year for the basic service and separately scoped advanced offerings starting around $2,500/year. Billing and agency agreement flows are intentionally not implemented in this pilot.
