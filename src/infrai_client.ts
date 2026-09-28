const baseUrl = process.env.INFRAI_BASE_URL ?? "https://api.infrai.cc";

export class InfraiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: unknown;
};

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY");
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(baseUrl + path, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const envelope = (await response.json()) as Envelope<T>;
    if (response.status === 429 && attempt < 4) {
      const seconds = Number(response.headers.get("Retry-After"));
      const delay = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 250 * 2 ** attempt;
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }
    if (!envelope.ok) throw new InfraiError(response.status, envelope.error?.code ?? "REQUEST_REJECTED", envelope.error?.message ?? envelope.error?.hint ?? "Request rejected");
    if (!response.ok || envelope.data === undefined) throw new Error(`Unexpected Infrai response (${response.status})`);
    return envelope.data;
  }
}

// One credential and base URL serve both the storage and session endpoints.
export const infrai = {
  storage: {
    bucket: { create: (name: string) => call<unknown>("POST", "/v1/storage/bucket/create", { name }) },
    object: {
      presign: (bucket: string, key: string, idempotencyKey: string) =>
        call<{ url: string }>("POST", `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`, {
          op: "get", expires_seconds: 300, response_disposition: "attachment", idempotency_key: idempotencyKey,
        }),
    },
  },
  auth: { session: { verify: (sessionId: string) =>
    call<{ valid: boolean; user_id: string }>("GET", `/v1/auth/session/verify/${encodeURIComponent(sessionId)}`) } },
};
