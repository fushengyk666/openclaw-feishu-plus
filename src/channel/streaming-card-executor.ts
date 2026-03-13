/**
 * streaming-card-executor.ts — Thin side-effect wrapper for CardKit streaming flow
 *
 * Purpose:
 * - Define a minimal injectable boundary around CardKit / IM side effects
 * - Prepare plugin.ts streaming flow for future mock/contract tests
 * - Keep behavior unchanged for now
 */

export interface StreamingCardTarget {
  targetId: string;
  receiveIdType: "open_id" | "chat_id";
}

export interface StreamingCardSdk {
  createCard(payload: any): Promise<any>;
  updateContent(payload: any): Promise<any>;
  updateFinalCard(payload: any): Promise<any>;
  updateSettings(payload: any): Promise<any>;
}

export function createStreamingCardSdk(client: any): StreamingCardSdk {
  return {
    createCard: (payload) => client.cardkit.v1.card.create(payload),
    updateContent: (payload) => (client.cardkit as any).v1.cardElement.content(payload),
    updateFinalCard: (payload) => (client.cardkit as any).v1.card.update(payload),
    updateSettings: (payload) => (client.cardkit as any).v1.card.settings(payload),
  };
}
