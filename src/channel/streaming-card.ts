/**
 * streaming-card.ts — Pure helpers for Feishu CardKit streaming cards
 *
 * Aligned with the official OpenClaw feishu plugin's streaming-card.ts approach:
 * - streaming_config with print_frequency_ms and print_step
 * - Non-empty initial content ("⏳ Thinking...")
 * - element_id = "content" (matching official naming)
 * - uuid generation for idempotent updates
 */

export const STREAMING_ELEMENT_ID = "content";

export function buildThinkingStreamingCard() {
  return {
    schema: "2.0",
    config: {
      streaming_mode: true,
      summary: { content: "[Generating...]" },
      streaming_config: {
        print_frequency_ms: { default: 50 },
        print_step: { default: 1 },
      },
    },
    body: {
      elements: [
        {
          tag: "markdown",
          content: "⏳ Thinking...",
          element_id: STREAMING_ELEMENT_ID,
        },
      ],
    },
  };
}

export function buildFinalStreamingCard(fullText: string) {
  return {
    schema: "2.0",
    config: {
      streaming_mode: false,
      summary: { content: truncateSummary(fullText) },
    },
    body: {
      elements: [
        {
          tag: "markdown",
          content: fullText,
        },
      ],
    },
  };
}

function truncateSummary(text: string, max = 50): string {
  if (!text) return "";
  const clean = text.replace(/\n/g, " ").trim();
  return clean.length <= max ? clean : clean.slice(0, max - 3) + "...";
}

/**
 * Merge streaming text fragments, matching the official plugin's mergeStreamingText logic.
 * Handles snapshot mode (full text replacement) and overlap detection.
 */
export function mergeStreamingText(
  previousText: string | undefined,
  nextText: string | undefined,
): string {
  const previous = typeof previousText === "string" ? previousText : "";
  const next = typeof nextText === "string" ? nextText : "";
  if (!next) return previous;
  if (!previous || next === previous) return next;
  if (next.startsWith(previous)) return next;
  if (previous.startsWith(next)) return previous;
  if (next.includes(previous)) return next;
  if (previous.includes(next)) return previous;

  // Merge partial overlaps
  const maxOverlap = Math.min(previous.length, next.length);
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    if (previous.slice(-overlap) === next.slice(0, overlap)) {
      return `${previous}${next.slice(overlap)}`;
    }
  }
  // Fallback: append to avoid losing tokens
  return `${previous}${next}`;
}

export function resolveStreamingTarget(params: {
  isDirect: boolean;
  senderOpenId: string;
  chatId: string;
}) {
  return {
    targetId: params.isDirect ? params.senderOpenId : params.chatId,
    receiveIdType: params.isDirect ? "open_id" : "chat_id",
  } as const;
}

export function buildStreamingReferenceMessage(cardId: string, target: {
  targetId: string;
  receiveIdType: "open_id" | "chat_id";
}) {
  return {
    params: { receive_id_type: target.receiveIdType },
    data: {
      receive_id: target.targetId,
      msg_type: "interactive",
      content: JSON.stringify({ type: "card", data: { card_id: cardId } }),
    },
  };
}

/**
 * Build content update payload for PUT /cardkit/v1/cards/{cardId}/elements/{elementId}/content
 */
export function buildStreamingContentUpdate(cardId: string, sequence: number, content: string) {
  return {
    url: `/open-apis/cardkit/v1/cards/${cardId}/elements/${STREAMING_ELEMENT_ID}/content`,
    body: {
      content,
      sequence,
      uuid: `s_${cardId}_${sequence}`,
    },
  };
}

/**
 * Build settings close payload for PATCH /cardkit/v1/cards/{cardId}/settings
 */
export function buildStreamingSettingsClose(cardId: string, sequence: number, finalText: string) {
  return {
    url: `/open-apis/cardkit/v1/cards/${cardId}/settings`,
    body: {
      settings: JSON.stringify({
        config: {
          streaming_mode: false,
          summary: { content: truncateSummary(finalText) },
        },
      }),
      sequence,
      uuid: `c_${cardId}_${sequence}`,
    },
  };
}

// Legacy exports for backward compat with tests
export function buildStreamingFinalizeUpdate(cardId: string, sequence: number, fullText: string) {
  return buildStreamingContentUpdate(cardId, sequence, fullText);
}

export function buildStreamingSettingsUpdate(cardId: string, sequence: number) {
  return buildStreamingSettingsClose(cardId, sequence, "");
}
