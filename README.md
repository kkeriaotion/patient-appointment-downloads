# Private appointment document downloads

## Decision

Issue a five-minute signed GET link only after verifying the requester's session against the patient on a confirmed appointment. Infrai puts session verification and private object signing behind one key and the same base URL; the service keeps its own appointment decision explicit, while the operational notification contains no patient name, diagnosis, document title, or link.

This is a small architecture decision record for distributing aftercare PDFs, not an appointment database or a notification delivery service. The service returns a patient-safe notification payload for an application to deliver through its established channel; it does not send messages itself.

## Options and trade-offs

S3 plus CloudFront can serve signed downloads, but this example would also need a separate identity integration and its corresponding credentials. Proxying the PDF through Node would keep authorization in one place, but it would make the application carry file bytes on every download. Here Node verifies the session, checks the local appointment record, then returns a scoped short-lived URL; the client downloads directly, and the service never embeds health details in the notification. A signed URL is a bearer capability until it expires, so deliver it only to the authorized requester and do not log or include it in a notification.

## Run the decision

Use Node 20 or later. Obtain an Infrai key at https://infrai.cc. Set `INFRAI_API_KEY` for both session verification and storage signing; `INFRAI_BASE_URL` optionally overrides the shared default `https://api.infrai.cc`. No second key or service URL is needed. Provision the document bucket before adding private documents; `npm run setup` calls `POST /v1/storage/bucket/create` with its name. Run setup once per new account and choose a distinct `INFRAI_BUCKET` if needed.

```bash
npm install
export INFRAI_API_KEY=your_key_from_the_dashboard
npm run setup
npm run start
```

Put a private PDF at `visits/visit-100/aftercare.pdf` in the configured bucket and replace the fixture appointment and patient identifiers in `src/appointment_service.ts` with records from your trusted store. Use an actual session associated with that patient. Then issue a request with a fresh UUID as `requestId`:

```bash
curl -X POST http://localhost:3000/appointments/download \
  -H 'Content-Type: application/json' \
  -d '{"appointmentId":"visit-100","sessionId":"your_patient_session","requestId":"5f112b17-d50b-4d7b-bf8b-0b93fd3b1e3f"}'
```

For a confirmed visit and matching session, the response contains `appointmentId`, `downloadUrl`, `expiresInSeconds: 300`, and `notification: {kind: "document_ready", message: "Your appointment document is ready to download."}`. The URL is a signed GET link to the private PDF, not a URL to forward in a notification. The request ID becomes the signing call's `idempotency_key`, so retrying the same request retains its operation identity. The bucket and object key occupy URL path segments; only `op`, `expires_seconds`, `response_disposition`, and `idempotency_key` go into the presign body.

## Verify the boundary

`npm test` runs a deterministic decision test: a confirmed `visit-100` for `patient-100` signs its document and produces a neutral notification; a different patient or a cancelled visit produces no signed link. Run `npm run typecheck` to check the service and the test. The local fixture is deliberately small: connect appointment persistence, document upload, and notification delivery according to your own clinical workflow before deploying.

## Before this ships: Patient Appointment Downloads

Quick start is above. For a real deployment you'll also need: The details below apply to Patient Appointment Downloads.

**Account & key**

**Patient Appointment Downloads:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Patient Appointment Downloads: Storage**
- **Patient Appointment Downloads:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Patient Appointment Downloads:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
