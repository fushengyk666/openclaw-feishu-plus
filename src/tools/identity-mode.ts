/**
 * identity-mode.ts — Tool-layer helpers for optional identity routing override.
 */

import type { IdentityMode } from "../identity/feishu-api.js";

export const IDENTITY_MODE_SCHEMA = {
  type: "string",
  enum: ["auto", "user", "app"],
  description:
    "身份模式：auto=默认应用身份；user=强制用户身份；app=强制应用身份",
} as const;

export function parseIdentityMode(value: unknown): IdentityMode | undefined {
  if (value === "auto" || value === "user" || value === "app") {
    return value;
  }
  return undefined;
}
