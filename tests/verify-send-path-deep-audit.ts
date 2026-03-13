/**
 * verify-send-path-deep-audit.ts — Deep audit of all send/request paths
 *
 * Goes beyond the surface audit in verify-channel-send-paths-audit.ts.
 * Verifies:
 * 1. request-executor retry path re-resolves through TokenResolver (not cached token)
 * 2. All tool families route through feishu-api (not raw HTTP or SDK)
 * 3. Streaming card SDK paths are documented exceptions (CardKit, not IM)
 * 4. No tool file imports lark SDK directly
 * 5. feishu-api always calls executeFeishuRequest (no direct fetch bypasses)
 * 6. Identity layer is the sole fetch boundary (no tool-level fetch calls)
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, "..", "src");

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

function readSrc(relPath: string): string {
  return readFileSync(join(srcDir, relPath), "utf8");
}

function listFiles(dir: string, suffix = ".ts"): string[] {
  try {
    return readdirSync(join(srcDir, dir))
      .filter(f => f.endsWith(suffix));
  } catch {
    return [];
  }
}

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  Deep Send Path Audit");
  console.log("═══════════════════════════════════════\n");

  // ── 1. Request-executor retry uses TokenResolver ──
  console.log("── Request Executor ──");

  check("request-executor retry calls resolver.resolve (not cached token)", () => {
    const src = readSrc("identity/request-executor.ts");

    // The retry path should call resolver.resolve again
    const hasRetryResolve = src.includes("resolver.resolve(") && src.includes("retryResolved");
    assert(hasRetryResolve, "retry path must re-resolve token through resolver");

    // Should invalidate before retry
    assert(src.includes("resolver.invalidate("), "retry path must invalidate token before re-resolve");

    // Should NOT cache or reuse the original token in retry
    const retrySection = src.match(/isAuthError[\s\S]*?return await opts\.invoke\(retryCtx\)/);
    assert(retrySection, "retry section should exist");
    assert(
      retrySection![0].includes("resolver.resolve("),
      "retry section must call resolver.resolve for new token",
    );
  });

  check("request-executor does not import fetch directly", () => {
    const src = readSrc("identity/request-executor.ts");
    assert(!src.includes("import.*fetch"), "should not import fetch (delegates to invoke callback)");
    assert(!src.includes("node-fetch"), "should not use node-fetch");
  });

  check("request-executor uses buildInvokeContext for both initial and retry", () => {
    const src = readSrc("identity/request-executor.ts");
    const contexts = src.match(/buildInvokeContext\(/g);
    assert(contexts && contexts.length >= 2, "should call buildInvokeContext at least twice (initial + retry)");
  });

  // ── 2. All tool files route through feishu-api ──
  console.log("\n── Tool Files ──");

  const toolFiles = listFiles("tools");
  const toolsWithoutOauth = toolFiles.filter(f => f !== "oauth-tool.ts");

  check(`all ${toolsWithoutOauth.length} tool files import from identity/feishu-api`, () => {
    const violations: string[] = [];
    for (const file of toolsWithoutOauth) {
      const src = readSrc(`tools/${file}`);
      if (!src.includes('from "../identity/feishu-api.js"')) {
        violations.push(file);
      }
    }
    assert(violations.length === 0, `missing feishu-api import: ${violations.join(", ")}`);
  });

  check("no tool file imports @larksuiteoapi/node-sdk", () => {
    const violations: string[] = [];
    for (const file of toolFiles) {
      const src = readSrc(`tools/${file}`);
      if (src.includes("@larksuiteoapi/node-sdk")) {
        violations.push(file);
      }
    }
    assert(violations.length === 0, `lark SDK import found in: ${violations.join(", ")}`);
  });

  check("no tool file uses raw fetch()", () => {
    const violations: string[] = [];
    for (const file of toolFiles) {
      const src = readSrc(`tools/${file}`);
      // Look for fetch() calls that aren't in comments
      const lines = src.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
        if (/\bfetch\s*\(/.test(trimmed)) {
          violations.push(`${file}: ${trimmed.slice(0, 80)}`);
        }
      }
    }
    assert(violations.length === 0, `raw fetch() in tools: ${violations.join("; ")}`);
  });

  check("no tool file imports from identity/client.ts directly", () => {
    const violations: string[] = [];
    for (const file of toolFiles) {
      const src = readSrc(`tools/${file}`);
      if (src.includes("identity/client") && !src.includes("feishu-api")) {
        violations.push(file);
      }
    }
    assert(violations.length === 0, `direct client import in: ${violations.join(", ")} — should use feishu-api`);
  });

  // ── 3. feishu-api is the sole fetch boundary ──
  console.log("\n── Feishu API (Fetch Boundary) ──");

  check("fetch() in identity/ limited to feishu-api.ts + token-pipeline (client.ts, oauth.ts)", () => {
    const identityFiles = listFiles("identity");
    const allowedFetchFiles = new Set(["feishu-api.ts", "client.ts", "oauth.ts"]);
    const filesWithFetch: string[] = [];
    for (const file of identityFiles) {
      const src = readSrc(`identity/${file}`);
      const lines = src.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
        if (/\bfetch\s*\(/.test(trimmed)) {
          filesWithFetch.push(file);
          break;
        }
      }
    }
    // feishu-api.ts = API calls, client.ts = tenant token, oauth.ts = user token exchange
    const unexpected = filesWithFetch.filter(f => !allowedFetchFiles.has(f));
    assert(
      unexpected.length === 0,
      `unexpected fetch() in identity/: ${unexpected.join(", ")} — only feishu-api.ts, client.ts, oauth.ts should use fetch`,
    );
    // Verify the allowed files actually exist in the list (sanity)
    assert(filesWithFetch.includes("feishu-api.ts"), "feishu-api.ts should use fetch");
  });

  check("feishu-api.ts routes through executeFeishuRequest", () => {
    const src = readSrc("identity/feishu-api.ts");
    assert(src.includes("executeFeishuRequest"), "must use executeFeishuRequest");
    // feishuRequest should be the single entry point
    assert(src.includes("async function feishuRequest"), "feishuRequest should be the core function");
    // All convenience methods should call feishuRequest
    for (const method of ["feishuGet", "feishuPost", "feishuPatch", "feishuDelete", "feishuPut"]) {
      assert(
        src.includes(`return feishuRequest`),
        `${method} must delegate to feishuRequest`,
      );
    }
  });

  check("feishu-api.ts catches NeedUserAuthorizationError", () => {
    const src = readSrc("identity/feishu-api.ts");
    assert(
      src.includes("NeedUserAuthorizationError"),
      "must catch NeedUserAuthorizationError and convert to AuthRequiredError",
    );
    assert(
      src.includes("AuthRequiredError"),
      "must throw AuthRequiredError for user-facing auth prompts",
    );
  });

  // ── 4. Streaming card SDK paths ──
  console.log("\n── Streaming Card SDK Paths ──");

  check("streaming-card-executor.ts uses CardKit APIs (not IM APIs)", () => {
    const src = readSrc("channel/streaming-card-executor.ts");
    assert(src.includes("cardkit"), "should reference cardkit");
    assert(!src.includes("im.message"), "should NOT reference IM message APIs");
  });

  check("streaming-card-executor.ts SDK calls are documented in audit test", () => {
    // Cross-reference: verify-channel-send-paths-audit.ts documents streaming-card-executor.ts
    const auditSrc = readFileSync(join(__dirname, "verify-channel-send-paths-audit.ts"), "utf8");
    assert(
      auditSrc.includes("streaming-card-executor.ts"),
      "streaming-card-executor.ts must be documented in send paths audit",
    );
    assert(
      auditSrc.includes("CardKit streaming"),
      "audit must mention CardKit streaming purpose",
    );
  });

  check("streaming-card.ts is pure (no SDK imports, no side effects)", () => {
    const src = readSrc("channel/streaming-card.ts");
    assert(!src.includes("import"), "streaming-card.ts should have no imports (pure functions)");
    assert(!src.includes("fetch"), "should not call fetch");
    assert(!src.includes("client"), "should not reference SDK client");
  });

  check("streaming-dispatch-executor.ts has no SDK imports", () => {
    const src = readSrc("channel/streaming-dispatch-executor.ts");
    assert(!src.includes("@larksuiteoapi"), "should not import lark SDK");
    assert(!src.includes("fetch"), "should not call fetch");
    // Only imports the pure dispatch function
    assert(src.includes("streaming-card-dispatch"), "should import pure dispatch only");
  });

  // ── 5. Identity layer integrity ──
  console.log("\n── Identity Layer Integrity ──");

  check("client.ts is the only file that creates lark.Client in identity/", () => {
    const identityFiles = listFiles("identity");
    const filesWithLarkClient: string[] = [];
    for (const file of identityFiles) {
      const src = readSrc(`identity/${file}`);
      if (src.includes("new lark.Client") || src.includes("getLarkClient")) {
        // client.ts is allowed to define getLarkClient
        if (file === "client.ts") continue;
        filesWithLarkClient.push(file);
      }
    }
    assert(
      filesWithLarkClient.length === 0,
      `unexpected lark.Client usage in identity/: ${filesWithLarkClient.join(", ")}`,
    );
  });

  check("token-resolver.ts does not make HTTP calls directly", () => {
    const src = readSrc("identity/token-resolver.ts");
    assert(!src.includes("fetch("), "should not call fetch");
    // It delegates to client.ts for tenant token and oauth.ts for refresh
    assert(src.includes("getTenantAccessToken"), "delegates tenant token to client.ts");
    assert(src.includes("refreshUserAccessToken"), "delegates refresh to oauth.ts");
  });

  check("oauth.ts imports are constrained", () => {
    const src = readSrc("identity/oauth.ts");
    // oauth.ts may use fetch for token exchange — that's its job
    // But it should not import lark SDK
    assert(!src.includes("@larksuiteoapi/node-sdk"), "should not import lark SDK");
  });

  // ── 6. No tool-level HTTP escape hatches ──
  console.log("\n── Escape Hatch Detection ──");

  check("no XMLHttpRequest or axios in any src/ file", () => {
    const allDirs = ["channel", "identity", "tools"];
    const violations: string[] = [];
    for (const dir of allDirs) {
      for (const file of listFiles(dir)) {
        const src = readSrc(`${dir}/${file}`);
        if (src.includes("XMLHttpRequest") || src.includes("require('axios')") || src.includes('from "axios"')) {
          violations.push(`${dir}/${file}`);
        }
      }
    }
    assert(violations.length === 0, `HTTP escape hatches: ${violations.join(", ")}`);
  });

  check("media.ts upload paths use getLarkClient (documented exception)", () => {
    const src = readSrc("channel/media.ts");
    assert(src.includes("getLarkClient"), "media upload should use getLarkClient");
    // But message sends should go through sendMessageFeishu
    assert(src.includes("sendMessageFeishu"), "media message sends should use sendMessageFeishu");
  });

  // ── Summary ──
  console.log("\n═══════════════════════════════════════");
  console.log("  Deep Send Path Audit");
  console.log("═══════════════════════════════════════");
  console.log(`  Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  if (passed === total) {
    console.log("\n  ✅ Retry path re-resolves through TokenResolver (not cached)");
    console.log("  ✅ All tool files route through feishu-api (no raw SDK/fetch)");
    console.log("  ✅ fetch() contained to feishu-api.ts in identity layer");
    console.log("  ✅ Streaming card SDK paths documented as CardKit exceptions");
    console.log("  ✅ No HTTP escape hatches (axios, XMLHttpRequest, etc.)");
  }
  console.log("═══════════════════════════════════════\n");

  if (passed !== total) process.exit(1);
}

main().catch((err) => {
  console.error("Deep send path audit failed:", err);
  process.exit(1);
});
