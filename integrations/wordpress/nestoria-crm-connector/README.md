# Nestoria CRM Connector 0.2.0

Install the self-contained `nestoria-crm-connector-0.2.0.zip` alongside Nestoria Property Projects. Replace the previous Khushii connector when prompted. Keep the original Nestoria Property Projects active.

Open **Settings > Nestoria CRM Connector** (also under **Property Projects > CRM Connector**):
1. Enter the publicly reachable HTTPS CRM API URL ending in `/api/v1`.
2. Enter the CRM API server's `WEBHOOK_SHARED_SECRET` in **Integration secret**. This is not the CRM login password. The secret is encrypted using WordPress authentication salts and PHP OpenSSL; saved secrets are never displayed. Leaving the field blank preserves the existing secret. Rotating WordPress salts requires re-entering the secret.
3. Click **Save connection**, then **Test CRM connection**. This makes an authenticated API request and checks database connectivity without creating a dummy lead. HTTP 401 indicates a secret or clock mismatch; 404 indicates the wrong API address or an outdated API; network errors indicate DNS, HTTPS or firewall problems. The CRM API must include `/integrations/website-connection` from this release.
4. Click **Import all saved enquiries** once. The connector walks saved private Nestoria enquiries in background batches of 50, skipping records already sent and queueing other valid records. Refresh this page to see the scan status. The scan queues delivery jobs; check the Property Enquiries CRM sync column for Sent, Queued, Failed or Needs review. New enquiries queue automatically.

WordPress Cron must run: use site traffic or a real scheduled server cron. Batches are spaced to respect the API rate limit; large imports take time. Invalid contacts require correction and records marked Needs review are excluded from bulk retry. Fix their WordPress metadata and clear `_khushii_crm_status` before restarting import. API failures retry up to five times. Restarting the import retries failed or stranded jobs; delivered leads remain skipped. Stable submission IDs prevent retries from creating duplicate CRM leads.

The API currently running only at `http://localhost:4000` cannot receive requests from your remote WordPress website. Deploy it to a public HTTPS address first; a Neon database connection alone does not publish the API. Server constants/environment variables `KHUSHII_CRM_API_URL` and `KHUSHII_CRM_WEBHOOK_SECRET`, if present, override the settings screen.

If ZIP installation still reports a missing plugin file, use the hosting file manager to place the self-contained `nestoria-crm-connector.php` at `wp-content/plugins/nestoria-crm-connector/nestoria-crm-connector.php`, then activate **Khushii CRM Connector for Nestoria** from Installed Plugins. Use one copy of this connector at a time. Do not replace or remove the original Nestoria plugin.

The connector maps name, phone, email, project, plot size, budget, visit date, message and source page. Local Indian mobile numbers are normalized to +91; explicit international numbers are preserved. A matching CRM project slug links the project, and the project name is retained in enquiry details. No marketing consent is inferred. Changing the website URL changes the external lead ID namespace.

Tested with PHP syntax checks, WordPress behavior stubs (including 123 saved enquiries, connection settings controls, secret encryption, signatures and retries), and local CRM API integration tests. Real WordPress activation and delivery require verification on the actual website.
