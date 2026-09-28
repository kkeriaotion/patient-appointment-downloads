import { createServer } from "node:http";
import { z } from "zod";
import { appointmentDownload, AccessDenied, type Appointment } from "./appointment_download.js";
import { infrai, InfraiError } from "./infrai_client.js";

const requestSchema = z.object({
  appointmentId: z.string().min(1),
  sessionId: z.string().min(1),
  requestId: z.string().uuid(),
}).strict();

// Replace this fixture with a trusted appointment database in an actual service.
const appointments = new Map<string, Appointment>([
  ["visit-100", { id: "visit-100", patientId: "patient-100", status: "confirmed", documentKey: "visits/visit-100/aftercare.pdf" }],
]);
const bucket = process.env.INFRAI_BUCKET ?? "patient-appointment-documents";

createServer(async (req, res) => {
  const reply = (status: number, payload: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(payload));
  };
  if (req.method !== "POST" || req.url !== "/appointments/download") {
    reply(404, { error: "Not found" });
    return;
  }
  try {
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 8192) { reply(413, { error: "Request too large" }); return; }
    }
    const parsed = requestSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) { reply(400, { error: "Invalid request body" }); return; }
    const result = await appointmentDownload(parsed.data, {
      appointments,
      verify: infrai.auth.session.verify,
      sign: (key, requestId) => infrai.storage.object.presign(bucket, key, requestId),
    });
    reply(200, result);
  } catch (error) {
    if (error instanceof SyntaxError) reply(400, { error: "Invalid JSON" });
    else if (error instanceof AccessDenied) reply(403, { error: error.message });
    else if (error instanceof InfraiError) reply(error.status >= 400 && error.status < 500 ? error.status : 502, { error: error.message, code: error.code });
    else reply(502, { error: "Unable to issue download" });
  }
}).listen(Number(process.env.PORT ?? 3000), () => console.log("Appointment download service listening"));
