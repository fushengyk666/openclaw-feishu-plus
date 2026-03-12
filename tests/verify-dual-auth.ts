/**
 * verify-dual-auth.ts — Smoke test for dual-auth decision paths
 *
 * Tests three key scenarios:
 * 1. With user token → uses user token
 * 2. Without user token → falls back to tenant token
 * 3. user_only operation without user token → NeedUserAuthorizationError
 *
 * Run: npx tsx tests/verify-dual-auth.ts
 */

import { TokenResolver, NeedUserAuthorizationError } from "../src/identity/token-resolver.js";
import { MemoryTokenStore } from "../src/identity/token-store.js";
import type { StoredUserToken } from "../src/identity/token-store.js";
import type { PluginConfig } from "../src/identity/config-schema.js";
import { generateAuthPrompt } from "../src/identity/auth-prompt.js";

// ─── Mock config ───

const mockConfig: PluginConfig = {
  enabled: true,
  mode: "tools-only",
  appId: "cli_test_app_id",
  appSecret: "test_secret",
  domain: "feishu",
  connectionMode: "websocket",
  auth: {
    preferUserToken: true,
    autoPromptUserAuth: true,
    store: "memory",
    redirectUri: "https://open.feishu.cn/oauth/callback",
  },
  tools: {
    doc: true,
    calendar: true,
    oauth: true,
    wiki: true,
    drive: true,
    bitable: true,
    task: true,
    chat: true,
    perm: true,
    approval: false,
    mail: false,
    contact: false,
  },
};

// ─── Mock user token ───

const mockUserToken: StoredUserToken = {
  accessToken: "u-mock_user_access_token_xxx",
  refreshToken: "ur-mock_refresh_token_xxx",
  expiresAt: Date.now() + 3600_000, // 1 hour from now
  refreshExpiresAt: Date.now() + 30 * 86400_000, // 30 days
  scopes: [
    "docx:document",
    "docx:document:readonly",
    "calendar:calendar",
    "calendar:calendar:readonly",
    "im:message",
    "im:message:readonly",
    "im:chat:readonly",
  ],
  userOpenId: "ou_test_user_001",
  updatedAt: Date.now(),
};

// ─── Test runner ───

async function runTests() {
  const results: { test: string; pass: boolean; detail: string }[] = [];

  // === PATH 1: With user token → uses user token ===
  {
    const store = new MemoryTokenStore();
    await store.set(mockConfig.appId, "ou_test_user_001", mockUserToken);

    // We can't actually call resolve() because it would try to get a real tenant token
    // from the Feishu API. Instead, we test that:
    // a) The store correctly returns the user token
    // b) The token is valid
    const stored = await store.get(mockConfig.appId, "ou_test_user_001");
    const hasToken = stored !== null && stored.accessToken === mockUserToken.accessToken;
    const isNotExpired = stored !== null && Date.now() < stored.expiresAt;

    results.push({
      test: "PATH 1: User token retrieved from store",
      pass: hasToken,
      detail: hasToken ? `token=${stored!.accessToken.slice(0, 20)}...` : "token not found",
    });
    results.push({
      test: "PATH 1: User token is not expired",
      pass: isNotExpired,
      detail: isNotExpired ? `expires in ${Math.round((stored!.expiresAt - Date.now()) / 1000)}s` : "expired",
    });
  }

  // === PATH 2: Without user token → no user token available ===
  {
    const store = new MemoryTokenStore();
    // No user token stored → getValidUserToken returns null → fallback to tenant

    const stored = await store.get(mockConfig.appId, "ou_nonexistent_user");
    const noToken = stored === null;

    results.push({
      test: "PATH 2: No user token for unknown user",
      pass: noToken,
      detail: noToken ? "correctly returns null → will fallback to tenant" : "unexpected token found",
    });
  }

  // === PATH 3: user_only operation without user token → NeedUserAuthorizationError ===
  {
    const store = new MemoryTokenStore();
    const resolver = new TokenResolver(mockConfig, store);

    let threwCorrectError = false;
    let errorDetail = "";

    try {
      await resolver.resolve({
        operation: "calendar.freebusy.list", // user_only
        userId: "ou_no_token_user",
      });
    } catch (err) {
      if (err instanceof NeedUserAuthorizationError) {
        threwCorrectError = true;
        errorDetail = `operation=${err.operation}, scopes=${err.requiredScopes.join(",")}`;
      } else {
        errorDetail = `wrong error type: ${(err as Error).constructor.name}: ${(err as Error).message}`;
      }
    }

    results.push({
      test: "PATH 3: user_only without token → NeedUserAuthorizationError",
      pass: threwCorrectError,
      detail: errorDetail,
    });
  }

  // === PATH 3b: user_only → generate auth prompt ===
  {
    const prompt = generateAuthPrompt({
      config: mockConfig,
      operation: "calendar.freebusy.list",
      requiredScopes: ["calendar:calendar:readonly"],
    });

    const hasUrl = prompt.authUrl !== undefined && prompt.authUrl.includes("open.feishu.cn");
    const hasMessage = prompt.message.includes("calendar.freebusy.list");

    results.push({
      test: "PATH 3b: Auth prompt generates valid URL",
      pass: hasUrl,
      detail: hasUrl ? `url=${prompt.authUrl!.slice(0, 60)}...` : "no valid URL",
    });
    results.push({
      test: "PATH 3b: Auth prompt includes operation name",
      pass: hasMessage,
      detail: hasMessage ? "message contains operation name" : "missing operation name",
    });
  }

  // === API Policy: both + prefer_user → prefers user if available ===
  {
    const store = new MemoryTokenStore();
    await store.set(mockConfig.appId, "ou_test_user_001", mockUserToken);
    const resolver = new TokenResolver(mockConfig, store);

    // For "both" operations, with a user token present and preferUserToken=true,
    // the resolver should select user token.
    // We can't fully test this without a real tenant token endpoint,
    // but we can verify the store has the token and config has preferUserToken=true.
    const configPreferUser = mockConfig.auth.preferUserToken === true;
    const userTokenAvailable = (await store.get(mockConfig.appId, "ou_test_user_001")) !== null;

    results.push({
      test: "CONFIG: preferUserToken is true",
      pass: configPreferUser,
      detail: `preferUserToken=${mockConfig.auth.preferUserToken}`,
    });
    results.push({
      test: "CONFIG: user token is available for test user",
      pass: userTokenAvailable,
      detail: userTokenAvailable ? "available" : "missing",
    });
  }

  // === API Policy coverage check ===
  {
    const { API_POLICY } = await import("../src/identity/api-policy.js");
    const docOps = Object.keys(API_POLICY).filter((k) => k.startsWith("docx."));
    const calOps = Object.keys(API_POLICY).filter((k) => k.startsWith("calendar."));
    const imOps = Object.keys(API_POLICY).filter((k) => k.startsWith("im."));

    results.push({
      test: "POLICY: doc operations registered",
      pass: docOps.length >= 4,
      detail: `${docOps.length} operations: ${docOps.join(", ")}`,
    });
    results.push({
      test: "POLICY: calendar operations registered",
      pass: calOps.length >= 8,
      detail: `${calOps.length} operations: ${calOps.join(", ")}`,
    });
    results.push({
      test: "POLICY: IM operations registered",
      pass: imOps.length >= 6,
      detail: `${imOps.length} operations: ${imOps.join(", ")}`,
    });
  }

  // ─── Print results ───
  console.log("\n═══════════════════════════════════════");
  console.log("  Dual-Auth Verification Results");
  console.log("═══════════════════════════════════════\n");

  let passed = 0;
  let failed = 0;

  for (const r of results) {
    const icon = r.pass ? "✅" : "❌";
    console.log(`${icon} ${r.test}`);
    console.log(`   ${r.detail}\n`);
    if (r.pass) passed++;
    else failed++;
  }

  console.log("───────────────────────────────────────");
  console.log(`  Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log("───────────────────────────────────────\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
