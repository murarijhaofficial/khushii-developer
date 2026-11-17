# Lead workspace, messages and follow-ups

Click any lead name in Leads or Recent Leads to open its workspace. The left panel contains contact, project/enquiry details, pipeline and assignment. The activity panel records notes, call outcomes, meetings, status and assignment changes, messages and follow-ups. Call lead opens the device dialler; a call is only recorded when its outcome is logged. No telephone provider or recording is implied.

## Access and storage
All workspace routes require the session cookie. Mutations require X-CSRF-Token and an editing role. Sales executives can access only their assigned leads. Administrators/managers can assign reminders to sales users who can access the lead. Other users cannot complete another employee's reminder. Viewers and marketing roles cannot write activities or send messages.

Additive migrations create LeadActivity, Reminder, OutboundMessage and LeadConsent and add durable webhook receipt fields. Both migrations were tested locally and applied to the configured Neon database. No existing lead data was replaced. New status and assignment changes are recorded transactionally. Prior history is not fabricated. The workspace shows the latest 100 logged activities and 100 message attempts; all records are retained in PostgreSQL.

## Email through Resend
Fill RESEND_API_KEY and EMAIL_FROM in apps/api/.env for local use and Render environment settings for hosted use. EMAIL_FROM must be a verified sender in Resend. Empty labelled spaces were added locally and to .env.example. Keys never go to Vercel or the browser.

The Email tab sends plain text to the lead's saved email address. Requests have a persistent unique request ID and an API-level fingerprint; duplicate attempts return the same saved message, while a changed payload with the same ID is rejected. Resend receives an Idempotency-Key. ACCEPTED means provider acceptance, not inbox delivery or reading. Resend delivery webhooks and attachments are not implemented in this release. Network timeouts are marked UNKNOWN and never blindly resent. Check provider logs before creating a new attempt.

## Approved WhatsApp templates
Fill WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID, WHATSAPP_API_VERSION (for example the version selected in your Meta account), WHATSAPP_APP_SECRET and WHATSAPP_VERIFY_TOKEN on the API server. Use a token authorized for the account with WhatsApp messaging and business-management access. The UI loads current APPROVED templates directly from Meta and rechecks approval when sending.

This release supports text-body templates with numbered variables and static text headers/footers. Media, dynamic headers, named variables and button templates are shown as unavailable. No free-form, bulk or WhatsApp Web messages are sent. Existing campaign drafts remain drafts.

Record explicit WhatsApp permission with evidence before sending. Website enquiry/contact consent is not converted into WhatsApp marketing permission. Opt-out is append-only and blocks sends; permission is checked again immediately before dispatch. The template preview is plain text and parameters are validated on the server.

Configure the Meta messages webhook callback as https://khushii-developer.onrender.com/api/v1/webhooks/whatsapp and set its verification token to WHATSAPP_VERIFY_TOKEN. Subscribe the correct phone/account. The app verifies the exact request bytes using WHATSAPP_APP_SECRET, deduplicates events in PostgreSQL and preserves status order. Receipts arriving before the local send response are retained and reconciled. Outgoing states distinguish SENDING, ACCEPTED, DELIVERED, READ, FAILED and UNKNOWN. This is not a unified inbound conversation inbox yet.

## Reminders and notifications
Set a title, future local date/time and recipient in the Reminder tab. The browser converts the chosen local time to UTC. In-app Follow-ups lists pending reminders and highlights overdue ones; browser alerts require explicit permission and the CRM open. Completed reminders remain in the lead history.

For closed-tab alerts, enable Email this employee when due and run the background worker:

    pnpm --filter @khushii/api worker

The Render blueprint includes khushii-crm-reminders. Configure its DATABASE_URL, RESEND_API_KEY and EMAIL_FROM to match the API. It scans every 30 seconds, atomically claims due notifications and uses an idempotency key. It skips users who no longer have lead access. Use real employee email addresses; seeded .example users cannot receive real mail. Worker notification failures do not mark the follow-up complete. Failed/unknown or interrupted SENDING deliveries require provider/operator review rather than an automatic duplicate resend. The email controls remain disabled until Resend is configured.

## API
- GET /api/v1/leads/:id/workspace
- POST /api/v1/leads/:id/activities (NOTE, CALL, MEETING)
- POST /api/v1/leads/:id/consent
- POST /api/v1/leads/:id/reminders
- PATCH /api/v1/leads/:id/reminders/:reminderId (complete)
- GET /api/v1/reminders (current user's pending reminders)
- GET /api/v1/communication/status
- GET /api/v1/communication/templates
- POST /api/v1/leads/:id/messages (EMAIL or WHATSAPP)
- GET and POST /api/v1/webhooks/whatsapp

## Verification and release
Provider adapter tests use mocked APIs; no real email or WhatsApp messages were sent. Integration tests cover owner/viewer access, notes, reminders, single worker claims, idempotent message retries, explicit opt-in, signature rejection, receipt deduplication/order and early-receipt reconciliation. Headless Chrome tested lead opening, note persistence, reminder creation and disabled unconfigured sending with a fictional local record that was removed afterward. The screenshot in .local/lead-workspace-preview.png contains only fictional QA data.

Push and redeploy Render/Vercel to publish the updated API/UI. Deploy and configure the reminder worker for email alerts. Fill the server-only provider credentials, set Meta webhook subscription and verify actual provider sends with an explicitly chosen permitted recipient before treating live messaging as connected. No external provider credentials or live messaging are verified yet.


## Repeat enquiries and phone matching

New manual, public form, signed website and WordPress sync enquiries are matched to the oldest lead with the same normalized phone number. Enter an Indian 10-digit mobile number or an international number with a leading country code. Each submission is retained in the lead workspace Enquiries section; submission IDs keep website retries idempotent. Existing lead assignment, status and contact details are preserved. Sales executives cannot add an enquiry to a lead they cannot access; a manager must handle it.

Deploy the `20261117010000_lead_enquiries` Prisma migration before the API. It copies each existing lead into its own enquiry record, but does not merge existing duplicate leads or their activities, consent and assignments. If several leads already share a phone number, future enquiries attach to the oldest one; review existing duplicates separately. The phone match identifies a number, not necessarily an individual, so shared numbers need human review. Phone changes on existing leads are currently blocked to avoid creating collisions.

## Campaign templates

The Templates page lists approved templates from Meta when the server-side WhatsApp configuration is present. Supported templates can be copied into a campaign draft. This does not submit or create a Meta template, and draft campaigns cannot send messages. Campaign audience selection, sending, and reports still need implementation and verification. Meta approval and explicit WhatsApp opt-in are required before marketing sends.
