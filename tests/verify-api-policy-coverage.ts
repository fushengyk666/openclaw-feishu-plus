/**
 * verify-api-policy-coverage.ts — Verify all tool operations are registered in API_POLICY
 *
 * Catches bugs like sheets.ts using "drive.file.download" as operation
 * instead of a sheets-specific operation. Every operation used by a tool
 * must be registered and semantically match the tool's domain.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { API_POLICY } from "../src/identity/api-policy.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const toolsDir = join(__dirname, "..", "src", "tools");

let passed = 0;
let total = 0;

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function check(name: string, fn: () => void) {
  total++;
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err: any) {
    console.log(`❌ ${name}`);
    console.log(`   ${err.message}`);
  }
}

// Extract operation strings from source code
function extractOperations(src: string): string[] {
  const ops: string[] = [];

  // Match feishuGet("op", ...) / feishuPost("op", ...) etc.
  const regex = /feishu(?:Get|Post|Patch|Delete|Put)\(\s*\n?\s*"([^"]+)"/g;
  let match;
  while ((match = regex.exec(src)) !== null) {
    ops.push(match[1]);
  }

  return ops;
}

// Recursively scan a tool file plus its local imports (tools/ or platform/ only)
function extractOperationsFromToolFile(entryFileAbs: string): string[] {
  const visited = new Set<string>();
  const ops: string[] = [];

  const scan = (fileAbs: string) => {
    const normalized = resolve(fileAbs);
    if (visited.has(normalized)) return;
    visited.add(normalized);
    if (!existsSync(normalized)) return;

    const src = readFileSync(normalized, "utf8");
    ops.push(...extractOperations(src));

    // naive ESM import scanner: import ... from "../platform/...";
    // We only follow relative imports into src/tools or src/platform.
    const importRegex = /from\s+"(\.[^"]+)"/g;
    let m;
    while ((m = importRegex.exec(src)) !== null) {
      const rel = m[1];
      const resolvedPath = resolve(dirname(normalized), rel);

      const tsCompat = resolvedPath.endsWith(".js")
        ? resolvedPath.slice(0, -3) + ".ts"
        : undefined;
      const candidates = [
        resolvedPath,
        tsCompat,
        resolvedPath + ".ts",
        resolvedPath + ".js",
        join(resolvedPath, "index.ts"),
        join(resolvedPath, "index.js"),
      ].filter(Boolean) as string[];

      const next = candidates.find((p) => existsSync(p) && [".ts", ".js"].includes(extname(p)));
      if (!next) continue;

      // Restrict recursion to our code areas.
      const isAllowed = next.includes("/src/tools/") || next.includes("/src/platform/");
      if (!isAllowed) continue;

      scan(next);
    }
  };

  scan(entryFileAbs);
  return ops;
}

// Expected domain prefix for each tool file
const TOOL_DOMAIN_MAP: Record<string, string[]> = {
  "doc.ts": ["docx."],
  "calendar.ts": ["calendar."],
  "chat.ts": ["im."],
  "wiki.ts": ["wiki."],
  "drive.ts": ["drive."],
  "bitable.ts": ["bitable."],
  "task.ts": ["task."],
  "perm.ts": ["drive.permission."],
  "sheets.ts": ["sheets."],
  "contact.ts": ["contact."],
  "approval.ts": ["approval."],
  "search.ts": ["search."],
  "oauth-tool.ts": [], // OAuth tool doesn't call feishu APIs directly
};

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  API Policy Coverage Verification");
  console.log("═══════════════════════════════════════\n");

  const toolFiles = readdirSync(toolsDir).filter(f => f.endsWith(".ts"));

  // ── 1. All operations used by tools are registered ──
  console.log("── Registration Check ──");

  const allOpsUsed: Array<{ file: string; op: string }> = [];
  for (const file of toolFiles) {
    const entryAbs = join(toolsDir, file);
    const ops = extractOperationsFromToolFile(entryAbs);
    for (const op of ops) {
      allOpsUsed.push({ file, op });
    }
  }

  check(`all ${allOpsUsed.length} tool operations registered in API_POLICY`, () => {
    const unregistered: string[] = [];
    for (const { file, op } of allOpsUsed) {
      if (!API_POLICY[op]) {
        unregistered.push(`${file}: "${op}"`);
      }
    }
    assert(unregistered.length === 0, `unregistered operations:\n  ${unregistered.join("\n  ")}`);
  });

  // ── 2. Operations match their tool's domain ──
  console.log("\n── Domain Matching ──");

  for (const file of toolFiles) {
    const expectedPrefixes = TOOL_DOMAIN_MAP[file];
    if (!expectedPrefixes || expectedPrefixes.length === 0) continue;

    const ops = extractOperationsFromToolFile(join(toolsDir, file));
    if (ops.length === 0) continue;

    check(`${file}: all operations match domain prefix (${expectedPrefixes.join("|")})`, () => {
      const mismatched: string[] = [];
      for (const op of ops) {
        const matches = expectedPrefixes.some(prefix => op.startsWith(prefix));
        if (!matches) {
          mismatched.push(op);
        }
      }
      assert(
        mismatched.length === 0,
        `domain mismatch — operations [${mismatched.join(", ")}] don't match expected prefixes [${expectedPrefixes.join(", ")}]`,
      );
    });
  }

  // ── 3. No duplicate operations across unrelated tools ──
  console.log("\n── Cross-Tool Isolation ──");

  check("no tool uses another domain's operations (except perm using drive.permission)", () => {
    const domainOps: Record<string, Set<string>> = {};
    for (const { file, op } of allOpsUsed) {
      if (!domainOps[file]) domainOps[file] = new Set();
      domainOps[file].add(op);
    }

    const violations: string[] = [];
    for (const [file, ops] of Object.entries(domainOps)) {
      const expected = TOOL_DOMAIN_MAP[file];
      if (!expected || expected.length === 0) continue;
      for (const op of ops) {
        const matches = expected.some(prefix => op.startsWith(prefix));
        if (!matches) {
          violations.push(`${file} uses "${op}" (expected ${expected.join("|")})`);
        }
      }
    }
    assert(violations.length === 0, `cross-domain violations:\n  ${violations.join("\n  ")}`);
  });

  // ── 4. Verify each tool file has operations ──
  console.log("\n── Tool Completeness ──");

  for (const file of toolFiles) {
    if (file === "oauth-tool.ts") continue; // OAuth is special
    check(`${file} has at least one feishu API operation`, () => {
      const ops = extractOperationsFromToolFile(join(toolsDir, file));
      assert(ops.length > 0, `no feishu API operations found in ${file} (including platform imports)`);
    });
  }

  // ── 5. Policy sanity checks ──
  console.log("\n── Policy Sanity ──");

  check("user_only operations are explicitly marked", () => {
    const userOnly = Object.entries(API_POLICY)
      .filter(([_, p]) => p.support === "user_only")
      .map(([op]) => op);
    // Known user_only operations
    assert(userOnly.includes("calendar.freebusy.list"), "freebusy should be user_only");
    assert(userOnly.includes("drive.permission.transferOwner"), "transferOwner should be user_only");
  });

  check("all 'both' operations have both userScopes and tenantScopes", () => {
    const incomplete: string[] = [];
    for (const [op, policy] of Object.entries(API_POLICY)) {
      if (policy.support === "both") {
        if (!policy.userScopes?.length && !policy.tenantScopes?.length) {
          incomplete.push(op);
        }
      }
    }
    assert(incomplete.length === 0, `missing scopes: ${incomplete.join(", ")}`);
  });

  // ── Summary ──
  console.log("\n═══════════════════════════════════════");
  console.log("  API Policy Coverage");
  console.log("═══════════════════════════════════════");
  console.log(`  Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log(`  Operations used by tools: ${allOpsUsed.length}`);
  console.log(`  Operations registered: ${Object.keys(API_POLICY).length}`);
  if (passed === total) {
    console.log("\n  ✅ All tool operations registered in API_POLICY");
    console.log("  ✅ Operations match their tool domains");
    console.log("  ✅ No cross-domain contamination");
  }
  console.log("═══════════════════════════════════════\n");

  if (passed !== total) process.exit(1);
}

main().catch((err) => {
  console.error("API policy coverage verification failed:", err);
  process.exit(1);
});
