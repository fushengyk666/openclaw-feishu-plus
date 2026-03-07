export class FeishuPlusError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "FeishuPlusError";
    this.code = code;
    this.details = details;
  }
}

export function asToolError(err) {
  if (err instanceof FeishuPlusError) {
    return {
      ok: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? null,
      },
    };
  }
  return {
    ok: false,
    error: {
      code: "unknown_error",
      message: err?.message || String(err),
      details: null,
    },
  };
}
