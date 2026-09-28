export type Appointment = { id: string; patientId: string; status: "confirmed" | "cancelled"; documentKey: string };
export type DownloadRequest = { appointmentId: string; sessionId: string; requestId: string };
export type Dependencies = {
  appointments: ReadonlyMap<string, Appointment>;
  verify: (sessionId: string) => Promise<{ valid: boolean; user_id: string }>;
  sign: (key: string, requestId: string) => Promise<{ url: string }>;
};

export class AccessDenied extends Error {}

export async function appointmentDownload(input: DownloadRequest, deps: Dependencies) {
  const appointment = deps.appointments.get(input.appointmentId);
  const session = await deps.verify(input.sessionId);
  if (!appointment || appointment.status !== "confirmed" || !session.valid || session.user_id !== appointment.patientId) {
    throw new AccessDenied("No download available for this appointment");
  }
  const signed = await deps.sign(appointment.documentKey, input.requestId);
  return {
    appointmentId: appointment.id,
    downloadUrl: signed.url,
    expiresInSeconds: 300,
    notification: { kind: "document_ready", message: "Your appointment document is ready to download." },
  };
}
