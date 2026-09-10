# District Lookup — agency lookup and administration

An RP Data representative lookup and administration portal. The current review build includes Martinez, Arpeeville and eight additional client agencies. Each instance has its own published content, drafts, address inventory and uploads. The automated fleet provisioning interface remains future work.

## Resident experience

- Martinez address suggestions from 13,882 county address points inside the district polygons; outside-city postal addresses are excluded.
- Server-side point-in-polygon assignment, address marker, district highlight, portrait, official email, shared council office phone, biography link and term end.
- Street and satellite map views, district browsing, citywide mayor, responsive layout, keyboard-operated search and a text answer alongside the map.
- `/` is the password-protected **RP Data Voter Lookup Instances** directory, grouped by agency type and project status. Martinez and Arpeeville appear in Active Agencies. Additional reviewed instances are available in Cities and Counties; other client cards remain queued until their sources pass review.
- `/martinez` (also `/Martinez`) presents four working designs with actual page screenshots, plus an administration preview.
- `/martinez/classic` keeps the original side-by-side layout; `/martinez/concierge` emphasizes the address and answer; `/martinez/explorer` uses a full map and floating detail card; `/martinez/council` integrates a portrait directory.
- All four use the same lookup hook, representative/contact components, published data and map. `/martinez/lookup` and `/embed` follow the published design choice. `/embed?design=classic|concierge|explorer|directory` provides explicit overrides.
- `/martinez/administration` is a read-only version of the actual administration component. It receives only `publicContent()` and an aggregate address count. It does not load private account data, activity or drafts, and cannot upload, save, publish or change security settings. `/admin` remains protected by password and TOTP.

## Agency administration

Martinez `/admin` and Solano County `/solano-county/admin` require a password and authenticator TOTP. Initial setup requires a random deployment setup token. Passwords use salted scrypt, TOTP secrets are encrypted with AES-256-GCM, sessions are hashed and stored server-side, and recovery codes work once. Mutations require an exact configured trusted origin and credential attempts are rate-limited.

Edit official names, titles, photos, contact information, staff contacts, term dates and vacancies. Switch optional public fields on or off, edit introductory text and copy website embed code. Upload JPG, PNG or GIF portraits; images are decoded, stripped of metadata and stored as WebP. Animated GIFs use the first frame.

Upload zipped shapefiles or polygon GeoJSON, explicitly select the district field, review the preview and save a draft. The server validates coordinate ranges, rings, self-intersections, duplicate district labels and overlapping districts. A replacement must retain coverage of at least 99.5% of the agency address inventory. Duplicate feature rows must first be dissolved by district; multipart polygons and holes are supported. City annexations or significant coverage changes require a GIS/address-data refresh outside this pilot UI.

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
| `ADDITIONAL_APP_ORIGINS` | Optional comma-separated additional exact HTTPS origins |
| `APP_SECRET`        | At least 32 random characters; retain securely |
| `ADMIN_SETUP_TOKEN` | A separate random setup token                  |
| `PORT`              | `3000` (match the domain target port)          |

For the custom domain, use these production settings after both custom hostnames have been attached to the Railway service and their DNS/TLS configuration is ready:

```dotenv
APP_URL=https://wheresmydistrict.com
ADDITIONAL_APP_ORIGINS=https://www.wheresmydistrict.com,https://district-lookup-production.up.railway.app
```

`APP_URL` is the canonical origin. `ADDITIONAL_APP_ORIGINS` explicitly trusts only the listed aliases for review sign-in, authentication, uploads and administrative writes. This setting does not configure DNS, attach Railway domains, grant CORS access, or trust other subdomains. Origins use their serialized URL form: lowercase scheme/hostname, no path or trailing slash, no query/fragment, no credentials, no wildcard and no explicit default port. Separate entries with commas; surrounding whitespace is allowed, but empty entries or malformed values fail closed. Remove an alias from this setting when it should stop accepting writes.

Cookies remain host-only. Review-login redirects stay on the verified origin where the form was submitted, so signing in through `www` or Railway does not lose the newly set cookie by jumping to the canonical domain. Sign in separately when switching hostnames. Redirect destinations remain the existing approved relative routes; proxy `Host`/`X-Forwarded-Host` headers cannot grant origin trust.

For local development, use `APP_URL=http://localhost:3000` and leave aliases empty. If `APP_URL` is unset, the existing same-origin fallback remains available only on `localhost`, `127.0.0.1`, or `[::1]`, with the exact request port. Configuring aliases requires a canonical `APP_URL`. Public hosts require HTTPS and explicit configuration.

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

## September 9 review update

The root directory is an internal RP Data workspace with 31 cities and 14 counties. Review passwords are checked on the server using the `RP_REVIEW_PASSWORD_HASH` and `MARTINEZ_REVIEW_PASSWORD_HASH` configuration values (salted scrypt in the same format as admin passwords). No plaintext review password is bundled with the app. Review sessions expire after 24 hours and are scoped. They grant no real-agency administrative rights; RP review access can edit the isolated Arpeeville workspace. `/martinez` and `/martinez/administration` require agency or RP review access. Resident lookup routes and embeds remain public.

`/martinez/lookup` and `/embed` now follow the published `agency.lookupDesign` setting. The agency saves its selection in Add to your website, previews the draft, and publishes to switch its stable public link. Individual design URLs and explicit embed design overrides remain available.

Address results display a persistent red location pin and full city/state/ZIP. ZIP codes were joined by exact street/coordinate identity to all 13,882 existing records from the original county snapshot; `data/address-postal-codes.json` enriches the existing database without replacing coordinates, records or agency edits. Browsing a representative clears the address; address results hide district buttons and disable polygon selection until reset. Required background-map attribution remains visible.

The internal cards use 16 visually checked agency brand assets from official websites. Twenty-nine cards currently use initial placeholders while logo verification is pending. Only registered, reviewed agencies receive working lookup links. Client review passwords do not provide an RP staff impersonation capability.


## Registered agencies and separation

`data/instances.json` is a reviewed allowlist, not an end-user provisioning API. Real candidates stay in `data/candidates` until map, roster and address validation are complete. Only promoted `data/agencies/<id>` packages are deployed.

Each `/<id>` gallery has four agency-specific screenshots and an administration card. Public routes `/<id>/{classic,concierge,explorer,council,lookup,embed}` use that agency's published content. `/<id>/administration` is a protected read-only review for real agencies. `/<id>/preview` requires the agency's full MFA session.

The server selects the agency through a validated route and AsyncLocalStorage. No header, query string or editable content field can switch its data scope. Martinez retains its original database location and session cookie. Other agencies have separate volume subdirectories and cookies, and uploaded/seed portraits cannot be assigned across agencies.

New real agencies use a distinct setup token named `ADMIN_SETUP_TOKEN_<UPPERCASE_SLUG_WITH_UNDERSCORES>`. For Solano, configure `ADMIN_SETUP_TOKEN_SOLANO_COUNTY` and enroll at `/solano-county/admin/setup`; the Martinez setup token is rejected there. There is no default real-agency password. No client account invitations have been sent.

Arpeeville is the user's isolated administrative test city, presented with normal civic branding, a logo and “Good neighbors. Great lines.” Its offices, addresses and contacts remain fictional. Original default demo copy is normalized for presentation; custom agency edits are preserved. RP review access permits its editing workflow without granting any Martinez or Solano permissions.

Solano uses current county-published 2021 supervisorial polygons and 181,255 public address points, five verified supervisors, official headshots, phone/email and profile links. The archived RP final map is preserved for audit: the county's current lines correct 14 address assignments. Missing ZIPs and unverified term dates are left blank. Full details and source URLs are in `data/agencies/solano-county/provenance.json`.

Compressed address snapshots are expanded server-side on first initialization. Search indexes include the street, locality, state and ZIP; a one-time migration also updates existing databases. Public suggestion responses contain at most 40 local addresses. Lookup never falls back to an unrestricted geocoder.

Additional checks: `node scripts/test-arpeeville-http.mjs` verifies sandbox publishing and separation; `node scripts/test-instances-http.mjs` verifies independent real-agency setup tokens/MFA, county address search, full-address inputs and draft/publication separation. `node scripts/test-agency-expansion-http.mjs` verifies the seven additional routes, all four designs, local search and real-agency authorization. Run after the baseline HTTP suite against the disposable server. `npm test` validates all 487,302 real-agency addresses with the production geometry engine, plus the separate 25 fictional Arpeeville addresses.

### Reviewed client coverage

| Agency | Public address points | Districts | Occupied seats | Verified portraits |
| --- | ---: | ---: | ---: | ---: |
| Martinez | 13,882 | 4 | 4, plus citywide mayor | 5 |
| San Mateo | 27,832 | 5 | 5 | 0 |
| Burlingame | 8,215 | 5 | 5 | 0 |
| Millbrae | 6,485 | 5 | 4; District 3 vacant | 0 |
| Carpinteria | 4,953 | 5 | 5 | 5 |
| Diamond Bar | 17,975 | 5 | 5 | 5 |
| Solano County | 181,255 | 5 | 5 | 5 |
| Butte County | 123,888 | 5 | 5 | 5 |
| Yolo County | 102,817 | 5 | 5 | 5 |

San Mateo, Burlingame and Millbrae use historical public parcel situs addresses: pins are approximate, and newer buildings or individual units may be absent. Butte's source points also represent approximate parcel positions. These instances show that limitation beside the search/result and on the pin. Yolo shows its source's informational coverage note. Northern city portraits remain initials until verified downloads are available; no substitute portraits or logos are invented.

Current official GIS boundaries are used for Carpinteria, Diamond Bar, Butte, Yolo and Solano after an explicit comparison with the archived RP final map. Source geometry and measured changes are recorded with each package. San Mateo's documented final-plan district crosswalk comes from official final-map labels and population tables. Map conflicts such as Napa's overlapping current districts remain outside the live registry.

All seven newly promoted agencies have distinct first-administrator setup tokens configured in deployment. Account enrollment and MFA remain required; no client invitation or live client account was created by the import. The password-protected administration cards provide published-content previews for RP review.
