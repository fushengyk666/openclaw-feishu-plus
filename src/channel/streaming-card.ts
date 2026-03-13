/**
 * streaming-card.ts — Pure helpers for Feishu CardKit streaming cards
 */

export const STREAMING_ELEMENT_ID = "streaming_content";

export function buildThinkingStreamingCard() {
  return {
    schema: "2.0",
    config: { streaming_mode: true, summary: { content: "思考中..." } },
    body: {
      elements: [
        {
          tag: "markdown",
          content: "",
          text_align: "left",
          text_size: "normal_v2",
          element_id: STREAMING_ELEMENT_ID,
        },
      ],
    },
  };
}

export function buildFinalStreamingCard(fullText: string) {
  return {
    schema: "2.0",
    config: { streaming_mode: false },
    body: {
      elements: [
        {
          tag: "markdown",
          content: fullText,
          text_align: "left",
          text_size: "normal_v2",
        },
      ],
    },
  };
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

export function buildStreamingContentUpdate(cardId: string, sequence: number, content: string) {
  return {
    data: { content, sequence },
    path: { card_id: cardId, element_id: STREAMING_ELEMENT_ID },
  };
}

export function buildStreamingFinalizeUpdate(cardId: string, sequence: number, fullText: string) {
  return {
    data: {
      card: { type: "card_json", data: JSON.stringify(buildFinalStreamingCard(fullText)) },
      sequence,
    },
    path: { card_id: cardId },
  };
}

export function buildStreamingSettingsUpdate(cardId: string, sequence: number) {
  return {
    data: { settings: JSON.stringify({ streaming_mode: false }), sequence },
    path: { card_id: cardId },
  };
}
