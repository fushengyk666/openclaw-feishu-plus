/**
 * onboarding.ts — Feishu Plus Onboarding Adapter
 *
 * 提供完整的 onboarding 向导流程，对标 OpenClau feishu 扩展。
 */

const PAIRING_APPROVED_MESSAGE =
  "配对成功！您现在已经可以在飞书中与我对话了。";

export const feishuPlusOnboardingAdapter = {
  async run(prompter: any, cfg: any): Promise<any> {
    // Step 1: Check if already configured
    const section = cfg?.channels?.["openclaw-feishu-plus"];
    if (section?.appId && section?.appSecret) {
      await prompter.note([
        "Feishu Plus 已经配置完毕。",
        "App ID: " + section.appId,
        "Domain: " + (section.domain || "feishu"),
        "",
        "如需重新配置，请先清除现有配置。",
      ]);
      return { configured: true };
    }

    // Step 2: Prompt for App ID
    await prompter.note([
      "请打开飞书开放平台：",
      "  https://open.feishu.cn/app",
      "",
      "1. 创建或选择一个应用",
      "2. 开启“机器人”能力",
      "3. 获取 App ID 和 App Secret",
    ]);

    const appId = await prompter.input({
      name: "appId",
      message: "请输入 App ID：",
      required: true,
    });

    // Step 3: Prompt for App Secret
    const appSecret = await prompter.input({
      name: "appSecret",
      message: "请输入 App Secret：",
      required: true,
      type: "password",
    });

    // Step 4: Prompt for Domain
    const domain = await prompter.select({
      name: "domain",
      message: "请选择域：",
      options: [
        { value: "feishu", label: "飞书（国内）" },
        { value: "lark", label: "Lark（海外）" },
      ],
      default: "feishu",
    });

    // Step 5: Prompt for Connection Mode
    const connectionMode = await prompter.select({
      name: "connectionMode",
      message: "请选择连接方式：",
      options: [
        {
          value: "websocket",
          label: "WebSocket（推荐，实时性更好）",
        },
        {
          value: "webhook",
          label: "Webhook（需要公网地址）",
        },
      ],
      default: "websocket",
    });

    // Step 6: Webhook-specific prompts
    let webhookPort, webhookHost, webhookPath;
    if (connectionMode === "webhook") {
      await prompter.note([
        "Webhook 模式需要一个公网可访问的地址。",
        "确保 OpenClaw 所在机器可以被飞书服务器访问。",
      ]);

      webhookHost = await prompter.input({
        name: "webhookHost",
        message: "Webhook 监听主机（默认 0.0.0.0）：",
        default: "0.0.0.0",
      });

      webhookPort = await prompter.input({
        name: "webhookPort",
        message: "Webhook 监听端口（默认 3000）：",
        default: "3000",
        validate: (v: string) => !isNaN(Number(v)) || "必须是数字",
      });

      webhookPath = await prompter.input({
        name: "webhookPath",
        message: "Webhook 路径（默认 /webhook/feishu-plus）：",
        default: "/webhook/feishu-plus",
      });
    }

    // Step 7: Prompt for DM Policy
    const dmPolicy = await prompter.select({
      name: "dmPolicy",
      message: "请选择私聊策略：",
      options: [
        {
          value: "open",
          label: "Open（允许所有人私聊）",
        },
        {
          value: "pairing",
          label: "Pairing（配对后才可私聊）",
        },
        {
          value: "allowlist",
          label: "Allowlist（仅允许列表内用户）",
        },
      ],
      default: "open",
    });

    // Step 8: Prompt for Group Policy
    const groupPolicy = await prompter.select({
      name: "groupPolicy",
      message: "请选择群聊策略：",
      options: [
        {
          value: "open",
          label: "Open（允许所有群聊，需@）",
        },
        {
          value: "allowlist",
          label: "Allowlist（仅允许列表内群聊）",
        },
        {
          value: "disabled",
          label: "Disabled（禁用群聊）",
        },
      ],
      default: "open",
    });

    // Step 9: Prompt for Auth Strategy
    const preferUserToken = await prompter.confirm({
      name: "preferUserToken",
      message: "是否优先使用用户身份 Token（user_access_token）？",
      default: true,
    });

    const autoPromptUserAuth = await prompter.confirm({
      name: "autoPromptUserAuth",
      message: "当需要用户 Token 时是否自动提示授权？",
      default: true,
    });

    // Step 10: Confirm
    await prompter.note([
      "配置摘要：",
      `  App ID: ${appId}`,
      `  App Secret: ${appSecret.replace(/./g, "*")}`,
      `  Domain: ${domain}`,
      `  Connection Mode: ${connectionMode}`,
      connectionMode === "webhook"
        ? `  Webhook: ${webhookHost}:${webhookPort}${webhookPath}`
        : "",
      `  DM Policy: ${dmPolicy}`,
      `  Group Policy: ${groupPolicy}`,
      `  Prefer User Token: ${preferUserToken}`,
      `  Auto Prompt Auth: ${autoPromptUserAuth}`,
    ]);

    const confirmed = await prompter.confirm({
      name: "confirm",
      message: "确认保存此配置？",
      default: true,
    });

    if (!confirmed) {
      await prompter.note("配置已取消。");
      return { configured: false };
    }

    // Return merged config
    const config: any = {
      enabled: true,
      appId,
      appSecret,
      domain,
      connectionMode,
      dmPolicy,
      groupPolicy,
      auth: {
        preferUserToken,
        autoPromptUserAuth,
        store: "file",
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
      },
    };

    if (connectionMode === "webhook") {
      config.webhookHost = webhookHost;
      config.webhookPort = Number(webhookPort);
      config.webhookPath = webhookPath;
    }

    return { configured: true, config };
  },
};
