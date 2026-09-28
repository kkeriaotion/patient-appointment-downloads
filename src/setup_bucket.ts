import { infrai } from "./infrai_client.js";

const bucket = process.env.INFRAI_BUCKET ?? "patient-appointment-documents";
await infrai.storage.bucket.create(bucket);
console.log(`Created private document bucket: ${bucket}`);
