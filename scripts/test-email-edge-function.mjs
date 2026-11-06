import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("supabase/functions/sib-email-send/index.ts", "utf8");
const config = readFileSync("supabase/config.toml", "utf8");
const whatsapp = readFileSync("supabase/functions/sib-whatsapp-send/index.ts", "utf8");

assert.ok(source.includes("const token = auth.replace(/^Bearer\\s+/i, \"\")"),
  "Manual email requests must correctly extract the bearer token");
assert.ok(source.includes("/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/"),
  "Email validation must use whitespace and dot regex escapes correctly");
assert.equal(source.includes("/^[^\\\\s@]"), false,
  "Email validation must not match literal backslash-s sequences");
assert.ok(source.includes("auth.getUser(token)"),
  "Manual sends must validate the caller's Supabase session");
assert.ok(source.includes("membership.active !== true"),
  "Manual sends must require an active organization membership");
assert.ok(source.includes("sib_verify_email_cron_token"),
  "Scheduled reminders must validate the private cron token");
assert.ok(source.includes("const cronToken = req.headers.get(\"x-sib-cron-token\")"),
  "Scheduled reminders must not rely on an unauthenticated public request");
assert.ok(source.includes("textBody = \"Bonjour \"") && source.includes("\\n\\nNous"),
  "Scheduled reminder messages must contain real newline escapes");
assert.equal(source.includes("\\\\n\\\\nNous"), false,
  "Scheduled reminder messages must not contain literal backslash-n text");
assert.ok(config.includes("[functions.sib-email-send]") && config.includes("verify_jwt = false"),
  "The function must be configured for its explicit bearer/cron authentication checks");
assert.ok(whatsapp.includes('"Administrateur", "Super Administrateur", "Direction"'),
  "The Super Administrateur role must be authorized by the WhatsApp edge function");

console.log("Email edge function authentication and validation tests passed.");
