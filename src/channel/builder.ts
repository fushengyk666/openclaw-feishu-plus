/**
 * builder.ts — official-style reply card builder for Feishu Plus
 */

import type { FeishuFooterConfig } from "./footer-config.js";

export const STREAMING_ELEMENT_ID = "streaming_content";

function truncateSummary(text: string, max = 120): string {
  const clean = (text || "").replace(/[*_`#>~\[\]()]/g, "").replace(/\n+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 3)}...`;
}

function formatElapsed(ms: number): string {
  const seconds = ms / 1000;
  return seconds < 60 ? `${seconds.toFixed(1)}s` : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function optimizeMarkdownStyle(text: string): string {
  return (text || "").replace(/\n{3,}/g, "\n\n").trim();
}

function buildFooter(params: { elapsedMs?: number; isError?: boolean; isAborted?: boolean; footer?: Required<FeishuFooterConfig> }) {
  const zh: string[] = [];
  const en: string[] = [];
  if (params.footer?.status) {
    if (params.isError) {
      zh.push("出错");
      en.push("Error");
    } else if (params.isAborted) {
      zh.push("已停止");
      en.push("Stopped");
    } else {
      zh.push("已完成");
      en.push("Completed");
    }
  }
  if (params.footer?.elapsed && params.elapsedMs != null) {
    const d = formatElapsed(params.elapsedMs);
    zh.push(`耗时 ${d}`);
    en.push(`Elapsed ${d}`);
  }
  if (!zh.length) return [];
  const content = en.join(" · ");
  const zhContent = zh.join(" · ");
  return [{
    tag: "markdown",
    content: params.isError ? `<font color='red'>${content}</font>` : content,
    i18n_content: { zh_cn: params.isError ? `<font color='red'>${zhContent}</font>` : zhContent, en_us: params.isError ? `<font color='red'>${content}</font>` : content },
    text_size: "notation",
  }];
}

export function buildThinkingCard() {
  return {
    schema: "2.0",
    config: {
      wide_screen_mode: true,
      update_multi: true,
      streaming_mode: true,
      locales: ["zh_cn", "en_us"],
      summary: {
        content: "Thinking...",
        i18n_content: { zh_cn: "思考中...", en_us: "Thinking..." },
      },
    },
    body: {
      elements: [
        {
          tag: "markdown",
          content: "",
          text_align: "left",
          text_size: "normal_v2",
          margin: "0px 0px 0px 0px",
          element_id: STREAMING_ELEMENT_ID,
        },
        {
          tag: "markdown",
          content: " ",
          element_id: "loading_icon",
        },
      ],
    },
  };
}

export function buildStreamingPatchCard(text: string, reasoningText?: string) {
  const elements: Array<Record<string, unknown>> = [];
  if (reasoningText?.trim()) {
    elements.push({
      tag: "markdown",
      content: `💭 **Thinking...**\n\n${optimizeMarkdownStyle(reasoningText)}`,
      text_size: "notation",
    });
  }
  elements.push({
    tag: "markdown",
    content: optimizeMarkdownStyle(text || " "),
  });
  return {
    schema: "2.0",
    config: { wide_screen_mode: true, update_multi: true, locales: ["zh_cn", "en_us"] },
    body: { elements },
  };
}

export function buildCompleteCard(params: {
  text: string;
  reasoningText?: string;
  reasoningElapsedMs?: number;
  elapsedMs?: number;
  isError?: boolean;
  isAborted?: boolean;
  footer?: Required<FeishuFooterConfig>;
}) {
  const elements: Array<Record<string, unknown>> = [];
  if (params.reasoningText?.trim()) {
    const label = params.reasoningElapsedMs != null ? `Thought for ${formatElapsed(params.reasoningElapsedMs)}` : "Thought";
    const zhLabel = params.reasoningElapsedMs != null ? `思考了 ${formatElapsed(params.reasoningElapsedMs)}` : "思考";
    elements.push({
      tag: "collapsible_panel",
      expanded: false,
      header: {
        title: {
          tag: "markdown",
          content: `💭 ${label}`,
          i18n_content: { zh_cn: `💭 ${zhLabel}`, en_us: `💭 ${label}` },
        },
        vertical_align: "center",
        icon: { tag: "standard_icon", token: "down-small-ccm_outlined", size: "16px 16px" },
        icon_position: "follow_text",
        icon_expanded_angle: -180,
      },
      border: { color: "grey", corner_radius: "5px" },
      vertical_spacing: "8px",
      padding: "8px 8px 8px 8px",
      elements: [{ tag: "markdown", content: optimizeMarkdownStyle(params.reasoningText), text_size: "notation" }],
    });
  }
  elements.push({ tag: "markdown", content: optimizeMarkdownStyle(params.text) });
  elements.push(...buildFooter(params));
  return {
    schema: "2.0",
    config: {
      wide_screen_mode: true,
      update_multi: true,
      streaming_mode: false,
      locales: ["zh_cn", "en_us"],
      summary: { content: truncateSummary(params.text) },
    },
    body: { elements },
  };
}
