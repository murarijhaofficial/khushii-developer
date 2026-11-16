# Integration implementation notes

## CRM website forms

Admins can create a form under Integrations, optionally link it to a project, copy its iframe code, and enable or disable it. Leads appear in Leads with the originating form. A live website needs a publicly reachable HTTPS API and `VITE_API_URL` set to that public API URL when the web app is built; localhost works only on the same computer. Anyone who can reach an enabled form can submit it. Basic rate limiting and a honeypot are included, but production deployments need abuse monitoring and an appropriate anti-spam strategy. The form does not collect marketing consent. Never use a submission as WhatsApp marketing opt-in.

## Nestoria Property Projects connector

The supplied Nestoria Property Projects 2.2.0 stores each enquiry as a private `npp_lead` with `_npp_lead_*` metadata and does not itself send leads to the CRM. Install the separate `integrations/wordpress/nestoria-crm-connector-0.2.0.zip` alongside it; setup and batching instructions are in [the connector README](../integrations/wordpress/nestoria-crm-connector/README.md). The add-on schedules signed server-to-server delivery after Nestoria saves the last enquiry field, can queue older unsent enquiries in batches of 100, and displays delivery status in WordPress. It maps project, phone, email, plot size, budget, visit date, message and source page. Check invalid contact details in WordPress. Credentials remain server-side. WordPress Cron or a system cron must run, and a real submission on the actual site must be tested before describing this as connected.

## Custom WordPress plugin

`integrations/wordpress/khushii-crm-client.php` is a PHP helper for your existing custom plugin, not an automatically installed or connected plugin. Include it from your plugin and configure `KHUSHII_CRM_API_URL` (the public HTTPS API base ending in `/api/v1`) and `KHUSHII_CRM_WEBHOOK_SECRET` on the WordPress server only. The latter must match the API's `WEBHOOK_SHARED_SECRET`. Store them in server configuration or `wp-config.php`, not JavaScript or a public repository. The API must also be publicly reachable by WordPress.

After your plugin has saved a form submission, call `khushii_crm_send_website_lead($stable_id, $name, $phone, $email, $message, $project_slug)`. Use a persistent ID unique to the form submission and reuse it for every retry; phone must use E.164 format (for example `+919876543210`). Handle `WP_Error` and queue failed submissions for retry in your existing plugin. The helper does not install a hook or provide a retry queue. A test submission must be made from the real website to verify the connection. This endpoint does not persist consent fields; it must not be used as evidence of marketing consent.

For a non-PHP custom server, send JSON to `POST /api/v1/integrations/signed-website-leads` containing `externalSubmissionId`, `name`, `phone` and optional `email`, `message`, `projectSlug` and `source`. Set `X-CRM-Timestamp` to the current Unix time in seconds, and `X-CRM-Signature` to `sha256=` followed by the lowercase HMAC-SHA256 hex digest of the UTF-8 timestamp, a literal `.`, and the exact JSON request bytes, using `WEBHOOK_SHARED_SECRET` as the key. Timestamps outside five minutes are rejected. Retries need a new timestamp and signature but the same submission ID. An accepted duplicate returns the original lead ID. Keep server clocks synchronized.

The older `/integrations/website-leads` shared-key endpoint remains for compatibility; migrate callers to the signed endpoint before production. Neither endpoint connects WordPress by itself.

## Meta Lead Ads
Implement OAuth, Page permissions, webhook signature validation, leadgen event deduplication, Graph API lead retrieval, token refresh and field mapping. Not included in starter.

## Google Ads
Implement verified lead-form webhook endpoint, credential handling, campaign attribution and conversion API as appropriate. Not included in starter.

## LinkedIn
Lead Sync API access requires approval. Add OAuth, subscriptions, field mapping and polling/webhook handling after access approval. Not included in starter.

## WhatsApp Cloud API
Implement approved template synchronization, opt-in ledger, 24-hour window logic, inbound webhook verification, delivery status processing, queues, retry policy, opt-out suppression, rate limits and campaign approvals. Not included in starter. The campaign API only creates drafts.

The Nestoria connector now has a connection form in WordPress Settings > Nestoria CRM Connector. Save the public HTTPS API URL and integration secret, test the connection, then select Import all saved enquiries. The authenticated `/integrations/website-connection` endpoint checks connectivity without creating a lead. All-import scans use ID cursors and schedule paced delivery batches. No database migration is needed for this release.

Deployment order: publish the API on Render with the existing Neon DATABASE_URL and a server-side WEBHOOK_SHARED_SECRET, publish the web workspace on Vercel with VITE_API_URL pointing to the public Render base plus /api/v1, then set Render CORS_ORIGIN to the exact Vercel origin. Configure the WordPress connector using that same public API URL and matching secret. Publishing only Vercel or only Neon does not provide a reachable lead ingestion API. Prefer same-site custom domains for the app and API when using cookie authentication.
