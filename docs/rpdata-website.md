# RP Data website — September 24, 2026

Public pages: Home, What We Do, About Us, and My District. Clean routes at rpdata.net and www.rpdata.net; /rpdata equivalents remain on wheresmydistrict.com. The host rewrite does not grant review or administration access. Existing APP_URL and authentication origin restrictions are unchanged. RP Data marketing visits do not enter the lookup activity log as Agency directory visits.

Services follow Paul’s requested scope: Census Data Consulting, Census Outreach, GIS Services / Mapping, Data Analysis, My District. Contact buttons open the published RP business email, info@redistrictingpartners.com. No invented mailbox or nonfunctional contact form. Pricing follows the latest instruction: free until July 1, 2027, then $75 monthly or $900 yearly.

## Team sources

- Paul: user-provided leadership roles and https://redistrictingpartners.com/about/ . Existing RP headshot reused from the project.
- Jacob Thompson Fisher: team membership supplied by Paul. Mapping project history verified at https://redistrictingpartners.com/2020/ (Napa and San Juan Water District); deliberately no unverified corporate title or degree. Photo supplied by Paul earlier in this project.
- Chris Chaffee: professional experience from https://socalgrantmakers.org/events/event-calendar/understanding-luca-process-and-how-it-impacts-accurate-2030-census . Biography says former RP COO and does not claim exclusive current employment. Photo supplied by Paul earlier in this project.
- Elizabeth “Liz” Stitt: https://liberalarts.utexas.edu/lawanddemocracy/researchers/eas4477 . The rendered UT profile identifies her as Administrative Program Coordinator, Center for Law and Democracy, and describes prior RP and legislative work. Its current biography takes precedence over the older RP biography. Portrait downloaded from the page’s actual image URL: https://minio.la.utexas.edu/colaweb-prod/person_files/1/11893/elizabeth_stitt.jpg .

All biographies are concise paraphrases with links to the source pages. No UT endorsement is claimed. Photos are real supplied/source images. The home page map is a decorative vector illustration, not an agency boundary map.

## Website content management

Open **https://rpdata.net/admin**. It redirects to the protected RP staff workspace at **https://wheresmydistrict.com/admin/website**, using the existing RP team password. Agency administrator accounts and agency Sending Links cannot access the website editor. This is a native content editor in the existing application; it does not require a WordPress installation or plugins.

- **Pages:** Home, What We Do, About Us, and My District are seeded from the existing website. Expand sections to edit headings, rich text, links, photos, service cards, and team profiles. Add or reorder sections; create additional pages with their own address, search description, navigation label/order, and visibility.
- **Media library:** Upload JPG, PNG, WebP, and GIF files (first frame), add an image description, and reuse the pictures on different pages. Original team portraits and screenshots are also available. Files are re-encoded as WebP, limited to 8 MB / 30 megapixels at input and 2,000 pixels at output. Uploaded images are private until referenced by published content.
- **Site settings:** Edit the shared brand, footer, partner link, and contact section. Publishing these settings updates every page.
- **Save draft** keeps changes private; **Preview** opens the saved draft in a staff-only window; **Publish** saves and immediately publishes the current edits. **Unpublish** removes a page from public routes/navigation while keeping its draft. The homepage and shared settings always remain published. Existing core-page addresses are fixed; additional pages can use custom slugs.
- **Revision history:** Keeps the last 100 revisions per document, displays the latest 50, and restores an earlier version as a draft. Stale edits return a conflict rather than silently overwriting another editor. Unsaved changes trigger a browser leave warning.

Persistence is independent of agency content: `$DATA_DIR/rpdata-website/website.sqlite` plus the adjacent `media/` directory. On Railway this is on the existing `/data` volume. Seed content is loaded only when this website database is empty. Deployments do not overwrite editorial changes. Back up the database using SQLite's backup API (or a quiesced volume backup) together with the media directory; do not copy a live WAL database alone. No new credentials, hosting services, or paid dependencies were introduced.

Rich HTML is sanitized on save and read. Scripts, event handlers, iframes, and remote tracking images are removed. Edits and uploads require the RP review session and an existing allowed application Origin. The public website and its metadata only read published content. Draft previews are authenticated, not indexed, and not cached.

CMS verification: 84 unit/integration tests, 45 HTTP checks against a disposable database, production build, TypeScript, and lint pass. The HTTP suite covers staff-only access (including rejected Martinez review and agency Sending Link sessions), origin checks, private drafts/uploads, image validation, create/preview/publish/unpublish, history restoration, conflict detection, domain routing, shared contact publication, and unchanged agency data. A browser walkthrough also created and published a test page using rich formatting and an image from the media library. Test edits are local only.

Desktop and 390-pixel mobile layouts were checked in the browser, with no horizontal overflow on the public homepage or editor. CMS visual artifacts are in ../outputs/rpdata-cms; initial public-site artifacts remain in ../outputs/rpdata. No agency invitation emails sent.
