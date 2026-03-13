/**
 * streaming-card-dispatch.ts — Pure decision helpers for streaming dispatch
 */

export interface StreamingDispatchState {
  accumulatedText: string;
  streamingCardCreated: boolean;
  cardKitCardId: string | null;
}

export interface StreamingDispatchDecision {
  nextAccumulatedText: string;
  shouldCreateCard: boolean;
  shouldUpdateContent: boolean;
  shouldFinalizeCard: boolean;
  shouldFallbackToPlainText: boolean;
  plainTextToSend: string | null;
}

export function decideStreamingDispatch(params: {
  useStreaming: boolean;
  text: string;
  infoKind?: string;
  state: StreamingDispatchState;
}): StreamingDispatchDecision {
  const text = params.text ?? "";
  if (!text.trim()) {
    return {
      nextAccumulatedText: params.state.accumulatedText,
      shouldCreateCard: false,
      shouldUpdateContent: false,
      shouldFinalizeCard: false,
      shouldFallbackToPlainText: false,
      plainTextToSend: null,
    };
  }

  if (!params.useStreaming) {
    return {
      nextAccumulatedText: params.state.accumulatedText,
      shouldCreateCard: false,
      shouldUpdateContent: false,
      shouldFinalizeCard: false,
      shouldFallbackToPlainText: true,
      plainTextToSend: text,
    };
  }

  const shouldCreateCard = !params.state.streamingCardCreated;
  const nextAccumulatedText = params.state.accumulatedText + text;
  const hasCard = params.state.streamingCardCreated && !!params.state.cardKitCardId;

  if (hasCard) {
    return {
      nextAccumulatedText,
      shouldCreateCard,
      shouldUpdateContent: true,
      shouldFinalizeCard: params.infoKind === "final",
      shouldFallbackToPlainText: false,
      plainTextToSend: null,
    };
  }

  return {
    nextAccumulatedText,
    shouldCreateCard,
    shouldUpdateContent: false,
    shouldFinalizeCard: false,
    shouldFallbackToPlainText: !shouldCreateCard,
    plainTextToSend: !shouldCreateCard ? text : null,
  };
}
