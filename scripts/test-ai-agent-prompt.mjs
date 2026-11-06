import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("supabase/functions/sib-ai-agent/index.ts", "utf8");
assert.ok(source.includes("Administrateur ou Super Administrateur authentifié"),
  "The AI authority prompt must recognize the Super Administrateur role");
assert.ok(source.includes("Administrateur, Super Administrateur, Direction et RH peuvent créer ou modifier un employé"),
  "Employee-management instructions must include Super Administrateur");
assert.ok(source.includes("Administrateur, Super Administrateur, Direction ou RH"),
  "Payroll-generation instructions must include Super Administrateur");
assert.equal(source.includes("\\\\n\\\\nAUTORITÉ"), false,
  "The system prompt must not contain literal escaped newlines");
assert.ok(source.includes("\\n\\nAUTORITÉ"),
  "The system prompt must separate its authority section with real newline escapes");

console.log("AI agent role and prompt formatting checks passed.");
