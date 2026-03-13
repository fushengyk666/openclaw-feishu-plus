/**
 * verify-tool-toggle-registration.ts — ensure plugin respects tools toggle config
 */

import plugin from "../index.js";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const registeredTools: string[] = [];
  const api = {
    runtime: {},
    config: {
      channels: {
        "openclaw-feishu-plus": {
          appId: "cli_test_12345",
          appSecret: "test_secret_value",
          tools: {
            doc: false,
            calendar: true,
            oauth: false,
            wiki: false,
            drive: false,
            bitable: false,
            task: false,
            chat: false,
            perm: false,
            sheets: false,
            contact: false,
          },
        },
      },
    },
    registerChannel: (_arg: any) => {},
    registerTool: (tool: { name: string }) => {
      registeredTools.push(tool.name);
    },
  };

  plugin.register(api);

  assert(registeredTools.length > 0, "expected at least one tool to be registered");
  assert(
    registeredTools.every((name) => name.startsWith("feishu_plus_calendar_")),
    `expected only calendar tools, got: ${registeredTools.join(", ")}`,
  );
  assert(
    !registeredTools.some((name) => name.startsWith("feishu_plus_oauth_")),
    "oauth tools should not register when oauth toggle is false",
  );
  assert(
    !registeredTools.some((name) => name.startsWith("feishu_plus_doc_")),
    "doc tools should not register when doc toggle is false",
  );

  console.log("═══════════════════════════════════════");
  console.log("  Tool Toggle Registration Verification");
  console.log("═══════════════════════════════════════\n");
  console.log(`✅ only enabled tool family registered (${registeredTools.length} calendar tools)`);
  console.log("✅ disabled tool families not registered");
  console.log("✅ oauth toggle respected\n");
  console.log("───────────────────────────────────────");
  console.log("  Total: 3 | Passed: 3 | Failed: 0");
  console.log("───────────────────────────────────────\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
