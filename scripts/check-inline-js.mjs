import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const temp = mkdtempSync(join(tmpdir(), "sib-js-check-"));
let checked = 0;
let failed = false;

function check(source, label) {
  const file = join(temp, `check-${checked + 1}.js`);
  writeFileSync(file, source, "utf8");
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  checked += 1;
  if (result.status !== 0) {
    failed = true;
    console.error(`\n[SYNTAX ERROR] ${label}\n${result.stderr || result.stdout}`);
  } else {
    console.log(`[OK] ${label}`);
  }
}

function checkHtmlScripts(relativePath) {
  const html = readFileSync(resolve(root, relativePath), "utf8");
  if (!/^\\s*<!doctype html>/i.test(html)) {
    console.error(`[HTML ERROR] ${relativePath} must begin with <!doctype html>.`);
    failed = true;
    return;
  }

  const scriptTag = /<script\\b([^>]*)>([\\s\\S]*?)<\\/script\\s*>/gi;
  let match;
  let inlineCount = 0;
  while ((match = scriptTag.exec(html)) !== null) {
    const attrs = match[1] || "";
    if (/\\bsrc\\s*=/i.test(attrs)) continue;
    const typeMatch = attrs.match(/\\btype\\s*=\\s*["']?([^\\s"'>]+)/i);
    const type = typeMatch ? typeMatch[1].toLowerCase() : "text/javascript";
    if (!["text/javascript", "application/javascript", "module"].includes(type)) continue;
    const source = match[2].trim();
    if (!source) continue;
    inlineCount += 1;
    check(source, `${relativePath} inline script #${inlineCount}`);
  }
  if (inlineCount === 0) {
    console.error(`[HTML ERROR] No inline JavaScript blocks found in ${relativePath}; refusing to pass silently.`);
    failed = true;
  }
}

try {
  // Validate both the main app and the separately deployed training-centre page.
  checkHtmlScripts("index.html");
  checkHtmlScripts("formation/index.html");

  for (const file of ["supabase-config.js", "supabase-client.js", "offline-register.js", "service-worker.js"]) {
    check(readFileSync(resolve(root, file), "utf8"), file);
  }

  // Guard against accidentally publishing placeholders or a privileged Supabase key.
  const config = readFileSync(resolve(root, "supabase-config.js"), "utf8");
  if (/REMPLACER_|service_role|SUPABASE_SERVICE_ROLE_KEY/i.test(config)) {
    console.error("[CONFIG ERROR] Public Supabase config contains a placeholder or privileged-key marker.");
    failed = true;
  } else {
    console.log("[OK] Supabase public configuration does not contain placeholders or service-role markers");
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}

if (failed) process.exit(1);
console.log(`\\nJavaScript syntax validation passed (${checked} blocks/files).`);
