# Agency outreach and implementation

Entry points:

- RP dashboard: `/admin/outreach`, also linked from `/admin` and `/logs`.
- Agency confirmation: `/<agency>/implementation`, linked as **Use this tool** from the password-protected preview gallery, layouts, and editor banner.
- Request detail: `/admin/outreach/<request UUID>`; submitted preview JSON can be downloaded by RP staff.

## Outreach reporting

Existing activity storage gains an `audience` column without rewriting or removing prior events. Earlier events remain `unknown`. New events distinguish preview entrances, agency password sessions, RP staff, and public traffic. The outreach dashboard excludes signed-in RP staff and public traffic by default. General logs retain all audiences and support audience and anonymous-visit filters plus CSV export.

Password acceptance, successful preview saves/resets, and implementation submissions are recorded on the server after the action succeeds; the public analytics endpoint rejects attempts to forge these event types. Protected preview editor and confirmation page views require the matching agency cookie or RP access. Passwords, billing fields, and form contents are not copied into activity logs.

Sending links copied from RP administration include `utm_source=rp_outreach`, `utm_medium=email`, and the agency as campaign. Existing short links still work. Browser session attribution survives the preview login redirect; campaign changes start a new session. Events are retained for 90 days. Sessions expire after 30 minutes of inactivity. These are anonymous visits, not email-open receipts or identified people. Browser blocking, withheld referrers, and clients without browser attribution can reduce tracking precision.

## Confirmation and billing

The agency supplies its preferred layout, hosted/embed preference, contact and billing information, requested adjustments, monthly/annual preference, and acknowledgements of authority and pricing. Submission captures an immutable copy of its current preview content and revision, and creates an implementation request plus a first-invoice draft in one SQLite transaction. Retries are idempotent; only one non-cancelled request per agency can exist. Stale preview revisions and stale offer versions are rejected.

Standard basic-service offer: free through June 30, 2027, then $75/month or $900/year. Per Paul's email to Sam, San José–Evergreen CCD receives free access through December 31, 2031; its earliest paid-service date is January 1, 2032. The introductory popup and confirmation page share the same offer source. Every request preserves the offer version and prices that were acknowledged.

RP staff can assign an owner and move a request through requested, reviewing, building, ready, live, or cancelled. The first invoice has draft/issued/paid/void states and an external invoice reference. Paid service cannot start before the agreed free period ends; a later service launch pushes billing forward. Marking an invoice issued requires live service, a reached billing date, and an external invoice reference. Cancelling an unused request requires voiding its draft. Workflow updates use revision checks and append a history entry.

This release does **not** send invoices, collect payments, provision a live MFA account automatically, publish the preview automatically, or create recurring invoices. It queues the implementation and first billing draft for RP review. A selected invoicing provider must be connected for invoice delivery and recurring collection. No agency was contacted or billed by this release.

## Storage and verification

- `DATA_DIR/activity.sqlite`: retained analytics; additive audience migration.
- `DATA_DIR/implementation.sqlite`: durable requests, immutable content snapshots, and workflow history. Uses the existing Railway volume.
- `service-offer.ts`: current agency offer policy.
- Confirmed: production build and lint; 90 unit/data tests; 51 outreach HTTP checks; 86 activity HTTP checks; 587 agency preview HTTP checks across all 18 agencies.
- Browser-verified locally: agency gallery CTA, complete form submission using fictional details, successful receipt, RP-only dashboard, and workflow update with history. No production signup or billing record was created by testing.

Also changes the parcel address marker heading from **Approximate address location** to **Address location**.
