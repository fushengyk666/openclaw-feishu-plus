/**
 * streaming-dispatch-executor.ts — orchestrates streaming-card side effects around
 * pure dispatch decisions so plugin.ts stays thin and testable.
 */

import { decideStreamingDispatch } from "./streaming-card-dispatch.js";

export interface StreamingDispatchRuntimeState {
  accumulatedText: string;
  streamingCardCreated: boolean;
  cardKitCardId: string | null;
}

export interface StreamingDispatchExecutorDeps {
  /**
   * Create a streaming card. Returns the cardKitCardId on success, null on failure.
   * This replaces the previous boolean return — the executor needs the cardId
   * to propagate it through state so subsequent dispatch calls know the card exists.
   */
  createStreamingCard(): Promise<string | null>;
  updateStreamingContent(text: string): Promise<void>;
  finalizeCard(fullText: string): Promise<void>;
  sendPlainText(text: string): Promise<void>;
}

export interface StreamingDispatchExecutorInput {
  useStreaming: boolean;
  text: string;
  infoKind?: string;
  state: StreamingDispatchRuntimeState;
}

export interface StreamingDispatchExecutorResult {
  state: StreamingDispatchRuntimeState;
  actions: string[];
}

export async function executeStreamingDispatch(
  input: StreamingDispatchExecutorInput,
  deps: StreamingDispatchExecutorDeps,
): Promise<StreamingDispatchExecutorResult> {
  const decision = decideStreamingDispatch({
    useStreaming: input.useStreaming,
    text: input.text,
    infoKind: input.infoKind,
    state: input.state,
  });

  if (!input.text?.trim()) {
    return { state: input.state, actions: [] };
  }

  const nextState: StreamingDispatchRuntimeState = { ...input.state };
  const actions: string[] = [];

  if (decision.shouldCreateCard) {
    const cardId = await deps.createStreamingCard();
    nextState.streamingCardCreated = cardId !== null;
    nextState.cardKitCardId = cardId;
    actions.push(cardId ? "create-card" : "create-card-failed");
  }

  if (nextState.streamingCardCreated && nextState.cardKitCardId) {
    nextState.accumulatedText = decision.nextAccumulatedText;

    // After card creation, push the first chunk content immediately
    // (the card was created with empty "thinking..." state).
    if (decision.shouldCreateCard && nextState.accumulatedText) {
      try {
        await deps.updateStreamingContent(nextState.accumulatedText);
        actions.push("initial-content-push");
      } catch {
        // Best-effort: card exists, content will catch up on next chunk
      }
    }

    if (decision.shouldUpdateContent) {
      await deps.updateStreamingContent(nextState.accumulatedText);
      actions.push("update-content");
    }

    if (decision.shouldFinalizeCard) {
      await deps.finalizeCard(nextState.accumulatedText);
      actions.push("finalize-card");
    }

    return { state: nextState, actions };
  }

  if (decision.shouldFallbackToPlainText && decision.plainTextToSend) {
    await deps.sendPlainText(decision.plainTextToSend);
    actions.push("fallback-plain-text");
  }

  return { state: nextState, actions };
}
