import { test } from "node:test";
import assert from "node:assert/strict";
import { appointmentDownload, AccessDenied, type Appointment } from "../src/appointment_download.js";

test("only the confirmed appointment's patient receives a link and safe notification", async () => {
  const appointments = new Map<string, Appointment>([
    ["visit-100", { id: "visit-100", patientId: "patient-100", status: "confirmed", documentKey: "visits/visit-100/aftercare.pdf" }],
  ]);
  let signatures = 0;
  const deps = {
    appointments,
    verify: async (sessionId: string) => ({ valid: true, user_id: sessionId }),
    sign: async (key: string, requestId: string) => {
      signatures++;
      assert.equal(key, "visits/visit-100/aftercare.pdf");
      assert.equal(requestId, "request-1");
      return { url: "https://download.example/temporary" };
    },
  };
  const input = { appointmentId: "visit-100", sessionId: "patient-100", requestId: "request-1" };
  const result = await appointmentDownload(input, deps);
  assert.equal(result.downloadUrl, "https://download.example/temporary");
  assert.equal(result.notification.message, "Your appointment document is ready to download.");
  await assert.rejects(appointmentDownload({ ...input, sessionId: "another-patient" }, deps), AccessDenied);
  appointments.set("visit-100", { ...appointments.get("visit-100")!, status: "cancelled" });
  await assert.rejects(appointmentDownload(input, deps), AccessDenied);
  assert.equal(signatures, 1);
});
