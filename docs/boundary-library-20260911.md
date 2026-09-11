# RP boundary library — September 11, 2026

The priority is map intake before completing more agency sites. The RP-only `/admin/boundaries` library catalogs 70 agencies with 70 viewable maps, and the main directory links the new agencies to their map reviews. The existing Mid-Peninsula Water lookup keeps its full gallery and administration routes.

| Agency type | Maps imported | Import issues requiring review |
| --- | ---: | ---: |
| School districts | 9 | 0 |
| County education boards | 8 | 4 |
| Community colleges | 27 | 9 |
| Special districts | 26 | 3 |
| Total | 70 | 16 |

These are boundary imports, not 70 newly completed voter lookup sites. Current adoption must be confirmed for every source before public address lookup. Rosters, portraits, logos, address coverage, client setup credentials, and four-layout review remain later activation steps. No existing published agency content, drafts, or credentials are changed by this import.

## Import provenance and checks

`scripts/import-boundary-library.py` reads the workspace's September 11 source inventory and candidate scan of RP Redistricting Files. That scan found 29,684 filesystem paths and 357 final/adopted/approved shapefile candidates for 121 agencies, including the 70 noncity/noncounty agencies selected here. The recorded unreadable folders were Foster City draft images, and one timed-out ZIP was a Ventura County candidate; neither is in this import.

The importer handles loose packages and ZIP members without extracting archives. Component matching is case-insensitive: the uppercase `.DBF` files in Grossmont-Cuyamaca and Yuba were present despite the earlier inventory reporting incomplete packages. Only the explicit district assignment and polygon geometry enter the app; other DBF attributes are excluded. The importer groups component polygons by district, preserves holes and disconnected pieces, transforms from each package's own `.prj` using longitude/latitude axis order, validates all polygons and bounds, and records interdistrict overlap areas. No geometry repair, coordinate rounding, smoothing, or artificial connecting polygons are applied.

The index stores original district values, file/folder provenance, source coordinate systems, blank-feature exclusions, polygon-part counts, overlap measurements and map SHA-256 digests. The local audit at `outputs/boundary-library/source-audit.json` additionally keeps source component hashes and excluded-record diagnostics. Every map read checks its content hash against the catalog. Map files and full catalog source details are server-side assets, accessible through RP-gated pages; they are not copied into public assets or client JavaScript bundles.

Special source decisions:

- Yosemite uses `2026 Final Packet/Yosemite CCD Clean Up 2026.shp`, replacing the older final packet as the intake candidate.
- Central Unified uses numeric `DistrictNu` assignments to dissolve 988 block records into seven trustee areas.
- Barstow's A–E and Shasta's A–G labels remain intact. Compton's COMPA–COMPE and Modesto Irrigation's D1–D5 source codes are preserved; roster crosswalks remain a later step.
- Grossmont-Cuyamaca's `GCCCD_Adopted_Plan.shp` uses `DATA` as a source-specific legacy assignment field. District 4 was visually compared with its numbered final-atlas image. The map remains flagged for confirmation of all five assignments against the adopted plan; DATA is never a general fallback for other sources.
- Napa and Ventura education boards receive distinct IDs including `board-of-education`; they never share county lookup identities.

## Review queue

Ten sources contain population in an excluded blank-assignment feature: Napa, Orange, Riverside and San Luis Obispo education boards; Los Rios, Napa Valley, Cuesta, Shasta, South Orange and Yosemite colleges. Their assigned districts can be reviewed, but agency coverage must be resolved before lookup activation.

Five sources have measured overlaps: Rio Hondo CCD (0.012 m²), Riverside CCD (four small overlaps totaling about 8.9 m²), Coastside Fire, Sacramento Metropolitan Fire, and Olivehurst PUD. All measurements are displayed on their source detail panels. Grossmont-Cuyamaca is the fifteenth flagged source, for its legacy assignment column. Olivehurst is the sixteenth flagged record. The initially inventoried final-labeled file was identical to Mt. San Jacinto CCD, in the wrong region, and is explicitly rejected. A separate `OPUD/Final Plan/OPUD Final Plan Base on Parcels.shp` supplies the correct five areas, with four measured overlaps totaling about 3,581 m² that require review before lookup activation. SLO BOE and Cuesta also have identical source geometry; both remain flagged for review, and current adoption must be verified separately.

## Access and validation

The preceding admin fix separated `/admin` and `/admin/login` from Martinez. RP review access opens the team hub; `/admin/agencies` is a neutral client sign-in chooser. Actual agency admin routes retain independent account authentication and MFA. RP review access does not grant access to real-agency editing APIs.

Boundary tests cover file integrity and district labels for every map, restricted destination routing, arbitrary-path rejection, color differentiation, education-board identity, and the existing water-district route. HTTP checks cover all 70 source-review pages, RP versus Martinez review authorization, nonpublic data files, and homepage map links. Browser review includes search, district selection, and actual street/satellite imagery for Barstow. Lint, TypeScript and the production build pass.
