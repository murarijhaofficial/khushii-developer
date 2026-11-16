# Khushii Website CRM Connector 0.5.0

Install the self-contained `nestoria-crm-connector-0.5.0.zip` alongside Nestoria Property Projects. Replace the previous Khushii connector when prompted. Keep the original Nestoria Property Projects active.

Open **Settings > Khushii Website CRM Connector** (also under **Property Projects > CRM Connector**):
1. Enter the publicly reachable HTTPS CRM API URL ending in `/api/v1`.
2. Enter the CRM API server's `WEBHOOK_SHARED_SECRET` in **Integration secret**. This is not the CRM login password. The secret is encrypted using WordPress authentication salts and PHP OpenSSL; saved secrets are never displayed. Leaving the field blank preserves the existing secret. Rotating WordPress salts requires re-entering the secret.
3. Click **Save connection**, then **Test CRM connection**. This makes an authenticated API request and checks database connectivity without creating a dummy lead. HTTP 401 indicates a secret or clock mismatch; 404 indicates the wrong API address or an outdated API; network errors indicate DNS, HTTPS or firewall problems. The CRM API must include `/integrations/website-connection` from this release.
4. Click **Import all saved enquiries** once. The connector walks saved private Nestoria enquiries in background batches of 50, skipping records already sent and queueing other valid records. Refresh this page to see the scan status. The scan queues delivery jobs; check the Property Enquiries CRM sync column for Sent, Queued, Failed or Needs review. New enquiries queue automatically.

WordPress Cron must run: use site traffic or a real scheduled server cron. Batches are spaced to respect the API rate limit; large imports take time. Invalid contacts require correction and records marked Needs review are excluded from bulk retry. Fix their WordPress metadata and clear `_khushii_crm_status` before restarting import. API failures retry up to five times. Restarting the import retries failed or stranded jobs; delivered leads remain skipped. Stable submission IDs prevent retries from creating duplicate CRM leads.

The API currently running only at `http://localhost:4000` cannot receive requests from your remote WordPress website. Deploy it to a public HTTPS address first; a Neon database connection alone does not publish the API. Server constants/environment variables `KHUSHII_CRM_API_URL` and `KHUSHII_CRM_WEBHOOK_SECRET`, if present, override the settings screen.

If ZIP installation still reports a missing plugin file, use the hosting file manager to place the self-contained `nestoria-crm-connector.php` at `wp-content/plugins/nestoria-crm-connector/nestoria-crm-connector.php`, then activate **Khushii CRM Connector for Nestoria** from Installed Plugins. Use one copy of this connector at a time. Do not replace or remove the original Nestoria plugin.

The connector maps name, phone, email, project, plot size, budget, visit date, message and source page. Local Indian mobile numbers are normalized to +91; explicit international numbers are preserved. A matching CRM project slug links the project, and the project name is retained in enquiry details. No marketing consent is inferred. Changing the website URL changes the external lead ID namespace.

Tested with PHP syntax checks, WordPress behavior stubs (including 123 saved enquiries, connection settings controls, secret encryption, signatures and retries), and local CRM API integration tests. Real WordPress activation and delivery require verification on the actual website.

## Delivery fixes in 0.5.0
New enquiries attempt signed delivery during WordPress shutdown instead of waiting exclusively for Cron. Failed attempts retain the retry queue; historical import and retries still need WP-Cron. A Send next queued enquiry now button lets an administrator process a pending record directly for diagnosis. The CRM sync column reports safe HTTP/network error details and records the last attempt time without logging the secret or contact data. The default API address is `https://khushii-developer.onrender.com/api/v1`; the saved key must match Render WEBHOOK_SHARED_SECRET. CORS does not restrict server-to-server WordPress delivery.

After updating the connector, Save connection, Test CRM connection, Import all saved enquiries, then use Send next queued enquiry now to verify one historical record. Check its Sent state in WordPress and the received-count/last-arrival indicator in CRM Integrations. Deploy the updated API and frontend to enable that indicator. If a record is Sent but not visible to a sales executive, an administrator must assign it first; new website leads begin unassigned. No real website delivery is claimed until the actual site has been verified.

## Direct sync from the CRM (0.5.0)
After replacing the connector on WordPress, save the same integration secret as Render. In CRM Integrations click Sync WordPress leads. The API reads all saved private Nestoria enquiries in batches of 50 via a signed GET request to `/wp-json/khushii-crm/v1/enquiries`. This does not require WP-Cron. Records already imported by automatic delivery are skipped by external submission ID; existing assignments and statuses are preserved. Invalid contacts are counted for review instead of silently claiming they were imported. The optional embedded CRM form has its own submission count and is not needed for existing Nestoria forms.

Deploy the matching API/frontend changes and set Render `WORDPRESS_SITE_URL=https://khushiideveloper.com` (also the code default). The website URL is configured only on the server; operators cannot use the sync endpoint to request arbitrary URLs. The website's REST route rejects unsigned requests and signatures older than five minutes; no private enquiries are exposed publicly.

If the CRM reports HTTP 404, update this connector and check WordPress permalinks/firewall settings. HTTP 401 means the signing secret or server clock differs. Exported enquiries are read-only on WordPress: this import does not change their WordPress push-delivery status. Inspect CRM import counts for the direct-sync result.

## Khushii Developer Enquiry Pro 2.3.0 support
The shared connector now handles both private `npp_lead` and `khep_enquiry` posts. Install this connector upgrade alongside your existing form plugins; do not replace Khushii Enquiry Pro or change SMTP settings. All-import and CRM Sync WordPress leads read both types through the signed export route. New Enquiry Pro entries queue after the final initial `_khep_crm_status` metadata is saved.

Enquiry Pro mapping: `_khep_name`, `_khep_email`, `_khep_phone` become contact fields; `_khep_interest` becomes enquiry interest; the complete `_khep_message` and the saved enquiry-contact consent flag are retained as notes. No project association or WhatsApp marketing consent is invented. Maximum incoming website note length is 6000 characters to retain the original 3000-character message plus context.

The form plugin's built-in Enable EspoCRM sync option calls a different `/api/v1/Lead` API with an X-Api-Key header. It is independent of this connector and is not compatible with Khushii CRM's signed endpoint. Use the shared connector settings for Khushii CRM. The original plugin's CRM status refers to its EspoCRM integration; inspect this connector's result and the CRM imported-lead count for Khushii delivery.

External IDs use separate `nestoria:` and `khep:` namespaces. Previously imported Nestoria leads retain their IDs; repeated Enquiry Pro imports skip existing records. CRM source labels identify each originating plugin. Update the API/frontend before importing Enquiry Pro so its namespace and full message length are accepted.
