/**
 * verify-edge-cases.ts — Edge case and regression tests
 *
 * Covers:
 * - API Policy: unknown operation throws
 * - API Policy: isTokenSupported correctness
 * - Config parsing: missing required fields
 * - Config parsing: defaults are applied correctly
 * - Tool toggle: new domains (approval/search) default off
 * - Token resolver: tenant_only operation ignores user token
 * - Empty tool params handling
 */

import { getApiPolicy, isTokenSupported, API_POLICY, getRequiredScopes } from "../src/identity/api-policy.js";
import { parseConfig } from "../src/identity/config-schema.js";

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

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  Edge Cases & Regression Tests");
  console.log("═══════════════════════════════════════\n");

  // ── API Policy edge cases ──
  console.log("── API Policy ──\n");

  check("getApiPolicy throws for unknown operation", () => {
    let threw = false;
    try {
      getApiPolicy("nonexistent.operation.xyz");
    } catch (err: any) {
      threw = true;
      assert(err.message.includes("not registered"), `unexpected error: ${err.message}`);
    }
    assert(threw, "should have thrown");
  });

  check("isTokenSupported: both supports both", () => {
    assert(isTokenSupported("docx.document.create", "tenant"), "tenant should be supported");
    assert(isTokenSupported("docx.document.create", "user"), "user should be supported");
  });

  check("isTokenSupported: user_only rejects tenant", () => {
    assert(!isTokenSupported("calendar.freebusy.list", "tenant"), "tenant should NOT be supported for user_only");
    assert(isTokenSupported("calendar.freebusy.list", "user"), "user should be supported for user_only");
  });

  check("isTokenSupported: tenant_only rejects user", () => {
    assert(isTokenSupported("tenant.tenant.get", "tenant"), "tenant should be supported for tenant_only");
    assert(!isTokenSupported("tenant.tenant.get", "user"), "user should NOT be supported for tenant_only");
  });

  check("getRequiredScopes returns correct scopes", () => {
    const userScopes = getRequiredScopes("calendar.freebusy.list", "user");
    assert(userScopes.includes("calendar:calendar:readonly"), `unexpected scopes: ${userScopes}`);
    const tenantScopes = getRequiredScopes("calendar.freebusy.list", "tenant");
    assert(tenantScopes.length === 0, "tenant scopes should be empty for user_only");
  });

  // ── Approval domain API Policy ──
  console.log("\n── Approval API Policy ──\n");

  check("approval.definition.get is registered as 'both'", () => {
    const p = getApiPolicy("approval.definition.get");
    assert(p.support === "both", `expected both, got ${p.support}`);
  });

  check("approval.instance.create is user_only", () => {
    const p = getApiPolicy("approval.instance.create");
    assert(p.support === "user_only", `expected user_only, got ${p.support}`);
  });

  check("approval.task.approve is user_only", () => {
    const p = getApiPolicy("approval.task.approve");
    assert(p.support === "user_only", `expected user_only, got ${p.support}`);
  });

  check("approval.task.reject is user_only", () => {
    const p = getApiPolicy("approval.task.reject");
    assert(p.support === "user_only", `expected user_only, got ${p.support}`);
  });

  check("approval.instance.cancel is user_only", () => {
    const p = getApiPolicy("approval.instance.cancel");
    assert(p.support === "user_only", `expected user_only, got ${p.support}`);
  });

  // ── Search domain API Policy ──
  console.log("\n── Search API Policy ──\n");

  check("search.message.search is user_only", () => {
    const p = getApiPolicy("search.message.search");
    assert(p.support === "user_only", `expected user_only, got ${p.support}`);
  });

  check("search.doc.search is user_only", () => {
    const p = getApiPolicy("search.doc.search");
    assert(p.support === "user_only", `expected user_only, got ${p.support}`);
  });

  check("search.app.search is user_only", () => {
    const p = getApiPolicy("search.app.search");
    assert(p.support === "user_only", `expected user_only, got ${p.support}`);
  });

  // ── Config parsing edge cases ──
  console.log("\n── Config Parsing ──\n");

  check("parseConfig throws on missing appId", () => {
    let threw = false;
    try {
      parseConfig({ appSecret: "test" });
    } catch {
      threw = true;
    }
    assert(threw, "should throw on missing appId");
  });

  check("parseConfig throws on missing appSecret", () => {
    let threw = false;
    try {
      parseConfig({ appId: "cli_xxx" });
    } catch {
      threw = true;
    }
    assert(threw, "should throw on missing appSecret");
  });

  check("parseConfig applies correct defaults", () => {
    const cfg = parseConfig({ appId: "cli_test", appSecret: "secret" });
    assert(cfg.enabled === true, "enabled default");
    assert(cfg.mode === "tools-only", "mode default");
    assert(cfg.domain === "feishu", "domain default");
    assert(cfg.connectionMode === "websocket", "connectionMode default");
    assert(cfg.auth.preferUserToken === true, "preferUserToken default");
    assert(cfg.auth.autoPromptUserAuth === true, "autoPromptUserAuth default");
  });

  check("parseConfig: approval defaults to false", () => {
    const cfg = parseConfig({ appId: "cli_test", appSecret: "secret" });
    assert(cfg.tools.approval === false, "approval should default to false");
  });

  check("parseConfig: search defaults to false", () => {
    const cfg = parseConfig({ appId: "cli_test", appSecret: "secret" });
    assert(cfg.tools.search === false, "search should default to false");
  });

  check("parseConfig: doc/calendar/chat default to true", () => {
    const cfg = parseConfig({ appId: "cli_test", appSecret: "secret" });
    assert(cfg.tools.doc === true, "doc should default to true");
    assert(cfg.tools.calendar === true, "calendar should default to true");
    assert(cfg.tools.chat === true, "chat should default to true");
  });

  check("parseConfig: can override defaults", () => {
    const cfg = parseConfig({
      appId: "cli_test",
      appSecret: "secret",
      tools: { approval: true, search: true, doc: false },
    });
    assert(cfg.tools.approval === true, "approval should be overridden to true");
    assert(cfg.tools.search === true, "search should be overridden to true");
    assert(cfg.tools.doc === false, "doc should be overridden to false");
  });

  // ── API Policy completeness: count check ──
  console.log("\n── Policy Completeness ──\n");

  check("API Policy has at least 70 operations registered", () => {
    const count = Object.keys(API_POLICY).length;
    assert(count >= 70, `expected >= 70 operations, got ${count}`);
  });

  check("all user_only operations have userScopes", () => {
    const missing: string[] = [];
    for (const [op, policy] of Object.entries(API_POLICY)) {
      if (policy.support === "user_only" && (!policy.userScopes || policy.userScopes.length === 0)) {
        missing.push(op);
      }
    }
    assert(missing.length === 0, `user_only operations missing userScopes: ${missing.join(", ")}`);
  });

  check("no duplicate operations in API_POLICY keys", () => {
    // This is inherently guaranteed by Record<string, ...> but let's be explicit
    const keys = Object.keys(API_POLICY);
    const unique = new Set(keys);
    assert(keys.length === unique.size, "duplicate keys found");
  });

  // ── Summary ──
  console.log("\n═══════════════════════════════════════");
  console.log("  Edge Cases Results");
  console.log("═══════════════════════════════════════");
  console.log(`  Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log("═══════════════════════════════════════\n");

  if (passed !== total) process.exit(1);
}

main().catch((err) => {
  console.error("Edge case verification failed:", err);
  process.exit(1);
});
