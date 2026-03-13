/**
 * verify-live-feishu-contract.ts — Real-environment contract verification harness
 *
 * Purpose:
 * - Exercise selected dual-auth tool paths against a real Feishu app/account
 * - Stay opt-in: exits cleanly with SKIP when required env vars are absent
 * - Record results to tests/live-contract-results.json for traceability
 *
 * Required env:
 * - FEISHU_PLUS_APP_ID
 * - FEISHU_PLUS_APP_SECRET
 *
 * Optional env (per-domain fixtures):
 * - FEISHU_PLUS_DOMAIN=feishu|lark                      (default: feishu)
 * - FEISHU_PLUS_USER_OPEN_ID=<open_id>                  (enables user-preferred path)
 * - FEISHU_PLUS_TOKEN_STORE=file|memory|keychain-first   (default: file)
 *
 * Per-endpoint fixture env:
 * - FEISHU_PLUS_LIVE_DOC_ID=<document_id>                (doc domain)
 * - FEISHU_PLUS_LIVE_CALENDAR_ID=<calendar_id>           (calendar domain, default: primary)
 * - FEISHU_PLUS_LIVE_CHAT_ID=<chat_id>                   (chat/im domain)
 * - FEISHU_PLUS_LIVE_WIKI_SPACE_ID=<space_id>            (wiki domain)
 * - FEISHU_PLUS_LIVE_DRIVE_FOLDER_TOKEN=<folder_token>   (drive domain)
 * - FEISHU_PLUS_LIVE_BITABLE_APP_TOKEN=<app_token>       (bitable domain)
 * - FEISHU_PLUS_LIVE_TASK_ID=<task_id>                   (task domain)
 * - FEISHU_PLUS_LIVE_PERMISSION_TOKEN=<token>            (permission domain)
 * - FEISHU_PLUS_LIVE_PERMISSION_TYPE=file|folder          (default: file)
 * - FEISHU_PLUS_LIVE_SHEETS_TOKEN=<spreadsheet_token>     (sheets domain)
 * - FEISHU_PLUS_LIVE_CONTACT_USER_ID=<user_id>            (contact domain)
 * - FEISHU_PLUS_LIVE_CONTACT_DEPARTMENT_ID=<department_id> (contact domain)
 *
 * Usage:
 *   FEISHU_PLUS_APP_ID=cli_xxx FEISHU_PLUS_APP_SECRET=xxx npx tsx tests/verify-live-feishu-contract.ts
 *
 * Notes:
 * - This script intentionally runs only read-style checks by default.
 * - Missing per-endpoint fixture envs cause that individual check to SKIP.
 * - Results are written to tests/live-contract-results.json after each run.
 */

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { parseConfig } from "../src/identity/config-schema.js";
import { createTokenStore } from "../src/identity/token-store.js";
import { TokenResolver } from "../src/identity/token-resolver.js";
import { initExecutor } from "../src/identity/request-executor.js";
import { initFeishuApi } from "../src/identity/feishu-api.js";

// Tool families
import { DocTools } from "../src/tools/doc.js";
import { CalendarTools } from "../src/tools/calendar.js";
import { ChatTools } from "../src/tools/chat.js";
import { WikiTools } from "../src/tools/wiki.js";
import { DriveTools } from "../src/tools/drive.js";
import { BitableTools } from "../src/tools/bitable.js";
import { TaskTools } from "../src/tools/task.js";
import { PermTools } from "../src/tools/perm.js";
import { SheetsTools } from "../src/tools/sheets.js";
import { ContactTools } from "../src/tools/contact.js";

// ─── Env helpers ───

function required(name: string): string | null {
  return process.env[name] || null;
}

function optional(name: string, fallback?: string): string | undefined {
  return process.env[name] || fallback || undefined;
}

// ─── Error categorization ───

type ErrorCategory = "auth" | "permission" | "not_found" | "rate_limit" | "network" | "config" | "unknown";

function categorizeError(err: any): ErrorCategory {
  const msg = String(err?.message || err).toLowerCase();
  const code = err?.code ?? err?.feishuCode;

  // Auth / token errors
  if (code === 99991663 || code === 99991664) return "auth";
  if (msg.includes("token") && (msg.includes("invalid") || msg.includes("expired"))) return "auth";
  if (msg.includes("need_user_authorization") || msg.includes("authrequired")) return "auth";
  if (err?.name === "NeedUserAuthorizationError" || err?.name === "AuthRequiredError") return "auth";

  // Permission errors
  if (code === 99991400 || code === 99991401) return "permission";
  if (msg.includes("permission") || msg.includes("forbidden") || msg.includes("scope")) return "permission";

  // Not found
  if (code === 99991402 || msg.includes("not found") || msg.includes("not exist")) return "not_found";

  // Rate limit
  if (code === 99991403 || msg.includes("rate limit") || msg.includes("too many")) return "rate_limit";

  // Network
  if (msg.includes("fetch") || msg.includes("econnrefused") || msg.includes("timeout") || msg.includes("network")) return "network";

  // Config
  if (msg.includes("not initialized") || msg.includes("appid") || msg.includes("config")) return "config";

  return "unknown";
}

// ─── Result tracking ───

interface CheckResult {
  name: string;
  domain: string;
  status: "pass" | "fail" | "skip";
  detail?: string;
  errorCategory?: ErrorCategory;
  tokenKind?: "tenant" | "user";
  keys?: string[];
  duration_ms?: number;
}

const results: CheckResult[] = [];

async function runCheck(name: string, domain: string, fn: () => Promise<unknown>): Promise<boolean> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration_ms = Date.now() - start;
    const keys = result && typeof result === "object"
      ? Object.keys(result as Record<string, unknown>).slice(0, 8)
      : undefined;
    // Extract tokenKind if available
    const tokenKind = (result as any)?.tokenKind;
    results.push({ name, domain, status: "pass", keys, tokenKind, duration_ms });
    console.log(`✅ ${name} (${duration_ms}ms)${tokenKind ? ` [${tokenKind}]` : ""}`);
    if (keys?.length) console.log(`   keys=${keys.join(",")}`);
    return true;
  } catch (err: any) {
    const duration_ms = Date.now() - start;
    const detail = String(err?.message || err).slice(0, 200);
    const errorCategory = categorizeError(err);
    results.push({ name, domain, status: "fail", detail, errorCategory, duration_ms });
    console.log(`❌ ${name} (${duration_ms}ms) [${errorCategory}]`);
    console.log(`   ${detail}`);
    return false;
  }
}

function skipCheck(name: string, domain: string, reason: string) {
  results.push({ name, domain, status: "skip", detail: reason });
  console.log(`⏭️  ${name} skipped: ${reason}`);
}

function writeResults() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outPath = join(__dirname, "live-contract-results.json");

  // Error category breakdown
  const failedResults = results.filter(r => r.status === "fail");
  const errorBreakdown: Record<string, number> = {};
  for (const r of failedResults) {
    const cat = r.errorCategory ?? "unknown";
    errorBreakdown[cat] = (errorBreakdown[cat] ?? 0) + 1;
  }

  // Domain-level summary
  const domains = [...new Set(results.map(r => r.domain))];
  const domainSummary: Record<string, { passed: number; failed: number; skipped: number; total: number }> = {};
  for (const domain of domains) {
    const dr = results.filter(r => r.domain === domain);
    domainSummary[domain] = {
      total: dr.length,
      passed: dr.filter(r => r.status === "pass").length,
      failed: dr.filter(r => r.status === "fail").length,
      skipped: dr.filter(r => r.status === "skip").length,
    };
  }

  // Token kind usage
  const tokenUsage = {
    tenant: results.filter(r => r.tokenKind === "tenant").length,
    user: results.filter(r => r.tokenKind === "user").length,
    unknown: results.filter(r => r.status === "pass" && !r.tokenKind).length,
  };

  const summary = {
    timestamp: new Date().toISOString(),
    env: {
      domain: optional("FEISHU_PLUS_DOMAIN", "feishu"),
      hasUserOpenId: !!optional("FEISHU_PLUS_USER_OPEN_ID"),
      tokenStore: optional("FEISHU_PLUS_TOKEN_STORE", "file"),
    },
    total: results.length,
    passed: results.filter(r => r.status === "pass").length,
    failed: results.filter(r => r.status === "fail").length,
    skipped: results.filter(r => r.status === "skip").length,
    errorBreakdown,
    tokenUsage,
    domainSummary,
    checks: results,
  };
  writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`\n📝 Results written to ${outPath}`);
}

// ─── Main ───

async function main() {
  const appId = required("FEISHU_PLUS_APP_ID");
  const appSecret = required("FEISHU_PLUS_APP_SECRET");

  if (!appId || !appSecret) {
    console.log("SKIP verify-live-feishu-contract: FEISHU_PLUS_APP_ID / FEISHU_PLUS_APP_SECRET not set");
    console.log("\nUsage:");
    console.log("  FEISHU_PLUS_APP_ID=cli_xxx FEISHU_PLUS_APP_SECRET=xxx npx tsx tests/verify-live-feishu-contract.ts");
    console.log("\nOptional fixture env vars:");
    console.log("  FEISHU_PLUS_LIVE_DOC_ID, FEISHU_PLUS_LIVE_CALENDAR_ID, FEISHU_PLUS_LIVE_CHAT_ID,");
    console.log("  FEISHU_PLUS_LIVE_WIKI_SPACE_ID, FEISHU_PLUS_LIVE_DRIVE_FOLDER_TOKEN,");
    console.log("  FEISHU_PLUS_LIVE_BITABLE_APP_TOKEN, FEISHU_PLUS_LIVE_TASK_ID,");
    console.log("  FEISHU_PLUS_LIVE_PERMISSION_TOKEN, FEISHU_PLUS_LIVE_SHEETS_TOKEN");
    process.exit(0);
  }

  console.log("═══════════════════════════════════════");
  console.log("  Live Feishu Contract Verification");
  console.log("═══════════════════════════════════════\n");
  console.log(`  App ID:  ${appId.slice(0, 10)}…`);
  console.log(`  Domain:  ${optional("FEISHU_PLUS_DOMAIN", "feishu")}`);
  console.log(`  User:    ${optional("FEISHU_PLUS_USER_OPEN_ID") || "(none — tenant-only mode)"}`);
  console.log("");

  // ── Initialize identity layer ──
  const config = parseConfig({
    appId,
    appSecret,
    domain: optional("FEISHU_PLUS_DOMAIN", "feishu") || "feishu",
    auth: {
      preferUserToken: true,
      autoPromptUserAuth: true,
      store: optional("FEISHU_PLUS_TOKEN_STORE", "file") || "file",
    },
  });

  const tokenStore = createTokenStore(config.auth.store);
  const resolver = new TokenResolver(config, tokenStore);
  initExecutor(resolver);
  initFeishuApi(config);

  const userId = optional("FEISHU_PLUS_USER_OPEN_ID");

  // Instantiate tool families
  const doc = new DocTools();
  const calendar = new CalendarTools();
  const chat = new ChatTools();
  const wiki = new WikiTools();
  const drive = new DriveTools();
  const bitable = new BitableTools();
  const task = new TaskTools();
  const perm = new PermTools();
  const sheets = new SheetsTools();
  const contact = new ContactTools();

  // ── DOC domain ──
  console.log("── Doc ──");
  const docId = optional("FEISHU_PLUS_LIVE_DOC_ID");
  if (docId) {
    await runCheck("doc.get", "doc", () => doc.execute("feishu_plus_doc_get", { document_id: docId }, userId));
    await runCheck("doc.rawContent", "doc", () => doc.execute("feishu_plus_doc_raw_content", { document_id: docId }, userId));
    await runCheck("doc.listBlocks", "doc", () => doc.execute("feishu_plus_doc_list_blocks", { document_id: docId, page_size: 5 }, userId));
  } else {
    skipCheck("doc.get", "doc", "FEISHU_PLUS_LIVE_DOC_ID not set");
    skipCheck("doc.rawContent", "doc", "FEISHU_PLUS_LIVE_DOC_ID not set");
    skipCheck("doc.listBlocks", "doc", "FEISHU_PLUS_LIVE_DOC_ID not set");
  }

  // ── CALENDAR domain ──
  console.log("\n── Calendar ──");
  let calendarId = optional("FEISHU_PLUS_LIVE_CALENDAR_ID");
  let calListResult: any = null;
  await runCheck("calendar.list", "calendar", async () => {
    calListResult = await calendar.execute("feishu_plus_calendar_list", { page_size: 50 }, userId);
    return calListResult;
  });

  // If no explicit calendar ID set, try to extract one from list result
  // (the "primary" alias only works with user_access_token)
  if (!calendarId && calListResult?.calendar_list?.length) {
    calendarId = calListResult.calendar_list[0].calendar_id;
    console.log(`   (auto-detected calendar_id: ${calendarId?.slice(0, 20)}…)`);
  }

  if (calendarId) {
    await runCheck("calendar.eventList", "calendar", () =>
      calendar.execute("feishu_plus_calendar_event_list", {
        calendar_id: calendarId,
        start_time: String(Math.floor(Date.now() / 1000) - 86400),
        end_time: String(Math.floor(Date.now() / 1000) + 86400 * 7),
        page_size: 50,
      }, userId),
    );
  } else {
    skipCheck("calendar.eventList", "calendar", "no calendar_id available (set FEISHU_PLUS_LIVE_CALENDAR_ID or ensure calendar.list returns results)");
  }

  // ── CHAT / IM domain ──
  console.log("\n── Chat/IM ──");
  await runCheck("chat.list", "im", () => chat.execute("feishu_plus_chat_list", { page_size: 10 }, userId));
  const chatId = optional("FEISHU_PLUS_LIVE_CHAT_ID");
  if (chatId) {
    await runCheck("chat.get", "im", () => chat.execute("feishu_plus_chat_get", { chat_id: chatId }, userId));
    await runCheck("chat.messageList", "im", () =>
      chat.execute("feishu_plus_message_list", { chat_id: chatId, page_size: 5 }, userId),
    );
  } else {
    skipCheck("chat.get", "im", "FEISHU_PLUS_LIVE_CHAT_ID not set");
    skipCheck("chat.messageList", "im", "FEISHU_PLUS_LIVE_CHAT_ID not set");
  }

  // ── WIKI domain ──
  console.log("\n── Wiki ──");
  await runCheck("wiki.listSpaces", "wiki", () => wiki.execute("feishu_plus_wiki_list_spaces", { page_size: 10 }, userId));
  const wikiSpaceId = optional("FEISHU_PLUS_LIVE_WIKI_SPACE_ID");
  if (wikiSpaceId) {
    await runCheck("wiki.listNodes", "wiki", () =>
      wiki.execute("feishu_plus_wiki_list_nodes", { space_id: wikiSpaceId, page_size: 10 }, userId),
    );
  } else {
    skipCheck("wiki.listNodes", "wiki", "FEISHU_PLUS_LIVE_WIKI_SPACE_ID not set");
  }

  // ── DRIVE domain ──
  console.log("\n── Drive ──");
  // Root folder listing works without fixture env
  await runCheck("drive.listRootFiles", "drive", () =>
    drive.execute("feishu_plus_drive_list_files", { page_size: 5 }, userId),
  );
  const folderToken = optional("FEISHU_PLUS_LIVE_DRIVE_FOLDER_TOKEN");
  if (folderToken) {
    await runCheck("drive.listFiles", "drive", () =>
      drive.execute("feishu_plus_drive_list_files", { folder_token: folderToken, page_size: 20 }, userId),
    );
  } else {
    skipCheck("drive.listFiles", "drive", "FEISHU_PLUS_LIVE_DRIVE_FOLDER_TOKEN not set");
  }

  // ── BITABLE domain ──
  console.log("\n── Bitable ──");
  const appToken = optional("FEISHU_PLUS_LIVE_BITABLE_APP_TOKEN");
  if (appToken) {
    await runCheck("bitable.getApp", "bitable", () => bitable.execute("feishu_plus_bitable_get_app", { app_token: appToken }, userId));
    await runCheck("bitable.listTables", "bitable", () => bitable.execute("feishu_plus_bitable_list_tables", { app_token: appToken }, userId));
  } else {
    skipCheck("bitable.getApp", "bitable", "FEISHU_PLUS_LIVE_BITABLE_APP_TOKEN not set");
    skipCheck("bitable.listTables", "bitable", "FEISHU_PLUS_LIVE_BITABLE_APP_TOKEN not set");
  }

  // ── TASK domain (v2 API — requires user_access_token) ──
  console.log("\n── Task ──");
  if (userId) {
    await runCheck("task.list", "task", () => task.execute("feishu_plus_task_list", { page_size: 10 }, userId));
    const taskId = optional("FEISHU_PLUS_LIVE_TASK_ID");
    if (taskId) {
      await runCheck("task.get", "task", () => task.execute("feishu_plus_task_get", { task_id: taskId }, userId));
    } else {
      skipCheck("task.get", "task", "FEISHU_PLUS_LIVE_TASK_ID not set");
    }
  } else {
    skipCheck("task.list", "task", "Task v2 API requires user_access_token (FEISHU_PLUS_USER_OPEN_ID not set)");
    skipCheck("task.get", "task", "Task v2 API requires user_access_token (FEISHU_PLUS_USER_OPEN_ID not set)");
  }

  // ── PERMISSION domain ──
  console.log("\n── Permission ──");
  const permToken = optional("FEISHU_PLUS_LIVE_PERMISSION_TOKEN");
  if (permToken) {
    await runCheck("perm.listPermissions", "permission", () =>
      perm.execute("feishu_plus_drive_list_permissions", {
        token: permToken,
        type: optional("FEISHU_PLUS_LIVE_PERMISSION_TYPE", "file"),
        page_size: 50,
      }, userId),
    );
  } else {
    skipCheck("perm.listPermissions", "permission", "FEISHU_PLUS_LIVE_PERMISSION_TOKEN not set");
  }

  // ── SHEETS domain ──
  console.log("\n── Sheets ──");
  const sheetsToken = optional("FEISHU_PLUS_LIVE_SHEETS_TOKEN");
  if (sheetsToken) {
    await runCheck("sheets.get", "sheets", () =>
      sheets.execute("feishu_plus_sheets_get", { spreadsheet_token: sheetsToken }, userId),
    );
    await runCheck("sheets.listSheets", "sheets", () =>
      sheets.execute("feishu_plus_sheets_list", { spreadsheet_token: sheetsToken }, userId),
    );
  } else {
    skipCheck("sheets.get", "sheets", "FEISHU_PLUS_LIVE_SHEETS_TOKEN not set");
    skipCheck("sheets.listSheets", "sheets", "FEISHU_PLUS_LIVE_SHEETS_TOKEN not set");
  }

  // ── CONTACT domain ──
  console.log("\n── Contact ──");
  if (userId) {
    await runCheck("contact.userMe", "contact", () =>
      contact.execute("feishu_plus_contact_user_me", {}, userId),
    );
  } else {
    skipCheck("contact.userMe", "contact", "FEISHU_PLUS_USER_OPEN_ID not set (user_only path)");
  }

  const contactUserId = optional("FEISHU_PLUS_LIVE_CONTACT_USER_ID");
  if (contactUserId) {
    await runCheck("contact.userGet", "contact", () =>
      contact.execute("feishu_plus_contact_user_get", { user_id: contactUserId }, userId),
    );
  } else {
    skipCheck("contact.userGet", "contact", "FEISHU_PLUS_LIVE_CONTACT_USER_ID not set");
  }

  const contactDepartmentId = optional("FEISHU_PLUS_LIVE_CONTACT_DEPARTMENT_ID");
  if (contactDepartmentId) {
    await runCheck("contact.departmentGet", "contact", () =>
      contact.execute("feishu_plus_contact_department_get", { department_id: contactDepartmentId }, userId),
    );
    await runCheck("contact.departmentUsers", "contact", () =>
      contact.execute("feishu_plus_contact_department_list_users", {
        department_id: contactDepartmentId,
        page_size: 10,
      }, userId),
    );
  } else {
    skipCheck("contact.departmentGet", "contact", "FEISHU_PLUS_LIVE_CONTACT_DEPARTMENT_ID not set");
    skipCheck("contact.departmentUsers", "contact", "FEISHU_PLUS_LIVE_CONTACT_DEPARTMENT_ID not set");
  }

  // ── Summary ──
  const passed = results.filter(r => r.status === "pass").length;
  const failed = results.filter(r => r.status === "fail").length;
  const skipped = results.filter(r => r.status === "skip").length;

  console.log("\n═══════════════════════════════════════");
  console.log("  Live Contract Summary");
  console.log("═══════════════════════════════════════");
  console.log(`  Total:   ${results.length}`);
  console.log(`  Passed:  ${passed}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped}`);

  // Domain breakdown
  const domains = [...new Set(results.map(r => r.domain))];
  console.log("\n  Per-Domain:");
  for (const domain of domains) {
    const domainResults = results.filter(r => r.domain === domain);
    const domainPassed = domainResults.filter(r => r.status === "pass").length;
    const domainTotal = domainResults.length;
    const domainSkipped = domainResults.filter(r => r.status === "skip").length;
    console.log(`  ${domain.padEnd(12)} ${domainPassed}/${domainTotal - domainSkipped} passed${domainSkipped ? `, ${domainSkipped} skipped` : ""}`);
  }

  // Error category breakdown (if failures exist)
  if (failed > 0) {
    const failedResults = results.filter(r => r.status === "fail");
    const errorCats: Record<string, number> = {};
    for (const r of failedResults) {
      const cat = r.errorCategory ?? "unknown";
      errorCats[cat] = (errorCats[cat] ?? 0) + 1;
    }
    console.log("\n  Failure Categories:");
    for (const [cat, count] of Object.entries(errorCats)) {
      console.log(`    ${cat}: ${count}`);
    }
  }

  // Token usage summary
  const tenantCount = results.filter(r => r.tokenKind === "tenant").length;
  const userCount = results.filter(r => r.tokenKind === "user").length;
  if (tenantCount + userCount > 0) {
    console.log(`\n  Token Usage: tenant=${tenantCount} user=${userCount}`);
  }

  console.log("═══════════════════════════════════════\n");

  // ── Write results ──
  writeResults();

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("verify-live-feishu-contract failed:", err);
  process.exit(1);
});
