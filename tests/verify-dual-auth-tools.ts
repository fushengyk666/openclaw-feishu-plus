/**
 * verify-dual-auth-tools.ts — Contract-ish smoke tests for migrated dual-auth tools
 *
 * Goal:
 * - Verify migrated tools actually go through feishu-api/request-executor
 * - Verify request path/method/basic auth header are formed as expected
 * - Avoid relying only on TypeScript build success
 *
 * Run:
 *   npx tsx tests/verify-dual-auth-tools.ts
 */

import { initExecutor } from "../src/identity/request-executor.js";
import { initFeishuApi } from "../src/identity/feishu-api.js";
import { TokenResolver } from "../src/identity/token-resolver.js";
import { MemoryTokenStore } from "../src/identity/token-store.js";
import type { PluginConfig } from "../src/identity/config-schema.js";
import { WikiTools } from "../src/tools/wiki.js";
import { DriveTools } from "../src/tools/drive.js";
import { BitableTools } from "../src/tools/bitable.js";
import { TaskTools } from "../src/tools/task.js";
import { PermTools } from "../src/tools/perm.js";
import { SheetsTools } from "../src/tools/sheets.js";
import { ContactTools } from "../src/tools/contact.js";
import { ApprovalTools } from "../src/tools/approval.js";
import { SearchTools } from "../src/tools/search.js";

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
    approval: true,
    mail: false,
    contact: true,
    search: true,
  },
};

type FetchCall = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
};

const calls: FetchCall[] = [];
const originalFetch = globalThis.fetch;

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  } as Response;
}

function installFetchMock() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = Object.fromEntries(
      Object.entries((init?.headers as Record<string, string>) ?? {}).map(([k, v]) => [k, String(v)]),
    );
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;

    calls.push({ url, method, headers, body });

    // tenant token endpoint
    if (url.includes("/open-apis/auth/v3/tenant_access_token/internal")) {
      return jsonResponse({
        code: 0,
        msg: "success",
        tenant_access_token: "t-mock-tenant-token",
        expire: 7200,
      });
    }

    // user access token endpoint
    if (url.includes("/open-apis/authen/v1/refresh_access_token")) {
      // Not used by these tests, but keep it stable.
      return jsonResponse({
        code: 0,
        msg: "success",
        data: {
          access_token: "u-mock-user-token",
          refresh_token: "ur-mock-refresh-token",
          expires_in: 3600,
          refresh_expires_in: 2592000,
          scope: "",
        },
      });
    }

    // generic API success payload
    return jsonResponse({
      code: 0,
      msg: "success",
      data: {
        echoedUrl: url,
        echoedMethod: method,
      },
    });
  }) as typeof fetch;
}

function restoreFetchMock() {
  globalThis.fetch = originalFetch;
}

function resetCalls() {
  calls.length = 0;
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function runCase(
  name: string,
  fn: () => Promise<unknown>,
  expected: {
    method: string;
    pathIncludes: string;
    authToken: string;
    /** For user-token paths, we should not fetch a tenant token. */
    allowTenantTokenFetch?: boolean;
  },
) {
  resetCalls();
  const result = await fn();

  assert(calls.length >= 1, `${name}: expected at least 1 fetch call, got ${calls.length}`);
  const authCalls = calls.filter((c) => c.url.includes("/open-apis/auth/v3/tenant_access_token/internal"));

  const allowTenantFetch = expected.allowTenantTokenFetch ?? true;
  if (allowTenantFetch) {
    assert(authCalls.length <= 1, `${name}: unexpected multiple tenant token fetches: ${authCalls.length}`);
  } else {
    assert(authCalls.length === 0, `${name}: expected no tenant token fetch, got ${authCalls.length}`);
  }

  const apiCall = calls[calls.length - 1];
  assert(apiCall.method === expected.method, `${name}: expected ${expected.method}, got ${apiCall.method}`);
  assert(apiCall.url.includes(expected.pathIncludes), `${name}: url mismatch: ${apiCall.url}`);
  assert(
    apiCall.headers.Authorization === `Bearer ${expected.authToken}`,
    `${name}: missing/invalid Authorization header (${apiCall.headers.Authorization ?? "<none>"})`,
  );

  return {
    name,
    result,
    apiUrl: apiCall.url,
    apiMethod: apiCall.method,
  };
}

async function main() {
  installFetchMock();
  try {
    const store = new MemoryTokenStore();

    // Provide a mock user token for user_only tools (task/search/etc.)
    await store.set(mockConfig.appId, "ou_mock_user", {
      accessToken: "u-mock-user-token",
      refreshToken: "ur-mock-refresh-token",
      expiresAt: Date.now() + 3600_000,
      refreshExpiresAt: Date.now() + 30 * 86400_000,
      scopes: ["task:task:readonly"],
      userOpenId: "ou_mock_user",
      updatedAt: Date.now(),
    } as any);

    const resolver = new TokenResolver(mockConfig, store);
    initExecutor(resolver);
    initFeishuApi(mockConfig);

    const wiki = new WikiTools();
    const drive = new DriveTools();
    const bitable = new BitableTools();
    const task = new TaskTools();
    const perm = new PermTools();
    const sheets = new SheetsTools();
    const contact = new ContactTools();
    const approval = new ApprovalTools();

    const results = [] as Array<{ name: string; apiMethod: string; apiUrl: string }>;

    results.push(await runCase(
      "wiki.listSpaces",
      () => wiki.execute("feishu_plus_wiki_list_spaces", { page_size: 10 }),
      { method: "GET", pathIncludes: "/open-apis/wiki/v2/spaces", authToken: "t-mock-tenant-token" },
    ) as any);

    results.push(await runCase(
      "drive.listFiles",
      () => drive.execute("feishu_plus_drive_list_files", { folder_token: "fld_xxx", page_size: 20 }),
      { method: "GET", pathIncludes: "/open-apis/drive/v1/files", authToken: "t-mock-tenant-token" },
    ) as any);

    results.push(await runCase(
      "bitable.listTables",
      () => bitable.execute("feishu_plus_bitable_list_tables", { app_token: "app_xxx" }),
      { method: "GET", pathIncludes: "/open-apis/bitable/v1/apps/app_xxx/tables", authToken: "t-mock-tenant-token" },
    ) as any);

    // task v2 is user_only — verify it uses user token (and does not fetch tenant token)
    results.push(await runCase(
      "task.get (user_only)",
      () => task.execute("feishu_plus_task_get", { task_id: "task_xxx" }, "ou_mock_user"),
      {
        method: "GET",
        pathIncludes: "/open-apis/task/v2/tasks/task_xxx",
        authToken: "u-mock-user-token",
        allowTenantTokenFetch: false,
      },
    ) as any);

    results.push(await runCase(
      "perm.listPermissions",
      () => perm.execute("feishu_plus_drive_list_permissions", { token: "tok_xxx", type: "file" }),
      { method: "GET", pathIncludes: "/open-apis/drive/v1/permissions/tok_xxx/members", authToken: "t-mock-tenant-token" },
    ) as any);

    results.push(await runCase(
      "sheets.get",
      () => sheets.execute("feishu_plus_sheets_get", { spreadsheet_token: "sheet_xxx" }),
      { method: "GET", pathIncludes: "/open-apis/sheets/v3/spreadsheets/sheet_xxx", authToken: "t-mock-tenant-token" },
    ) as any);

    results.push(await runCase(
      "contact.userGet",
      () => contact.execute("feishu_plus_contact_user_get", { user_id: "ou_xxx" }),
      { method: "GET", pathIncludes: "/open-apis/contact/v3/users/ou_xxx", authToken: "t-mock-tenant-token" },
    ) as any);

    results.push(await runCase(
      "approval.getDefinition",
      () => approval.execute("feishu_plus_approval_get_definition", { approval_code: "APPROVAL_XXX" }),
      { method: "POST", pathIncludes: "/open-apis/approval/v4/approvals", authToken: "t-mock-tenant-token" },
    ) as any);

    results.push(await runCase(
      "approval.getInstance",
      () => approval.execute("feishu_plus_approval_get_instance", { instance_id: "inst_xxx" }),
      { method: "GET", pathIncludes: "/open-apis/approval/v4/instances/inst_xxx", authToken: "t-mock-tenant-token" },
    ) as any);

    console.log("\n═══════════════════════════════════════");
    console.log("  Dual-Auth Tool Verification Results");
    console.log("═══════════════════════════════════════\n");

    for (const r of results) {
      console.log(`✅ ${r.name}`);
      console.log(`   ${r.apiMethod} ${r.apiUrl}\n`);
    }

    console.log("───────────────────────────────────────");
    console.log(`  Total: ${results.length} | Passed: ${results.length} | Failed: 0`);
    console.log("───────────────────────────────────────\n");
  } finally {
    restoreFetchMock();
  }
}

main().catch((err) => {
  restoreFetchMock();
  console.error("Tool verification failed:", err);
  process.exit(1);
});
