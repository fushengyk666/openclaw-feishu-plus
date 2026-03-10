/**
 * mention.ts — Feishu Plus Mention Handling
 *
 * 处理 @提及 的解析、格式化和构建。
 */

export interface MentionTarget {
  userId: string;
  name?: string;
}

/**
 * Extract mention targets from a Feishu message content string.
 */
export function extractMentionTargets(content: string): MentionTarget[] {
  const regex = /<at user_id="([^"]*)">(.*?)<\/at>/g;
  const targets: MentionTarget[] = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    targets.push({
      userId: match[1],
      name: match[2] || undefined,
    });
  }

  return targets;
}

/**
 * Extract message body after stripping all @mentions.
 */
export function extractMessageBody(content: string): string {
  return content
    .replace(/<at user_id="[^"]*">[^<]*<\/at>/g, "")
    .trim();
}

/**
 * Check if a message is a mention-forward request.
 */
export function isMentionForwardRequest(content: string): boolean {
  const mentions = extractMentionTargets(content);
  const body = extractMessageBody(content);
  return mentions.length > 0 && body.length > 0;
}

/**
 * Format a mention for text messages.
 */
export function formatMentionForText(userId: string, name?: string): string {
  return `<at user_id="${userId}">${name || userId}</at>`;
}

/**
 * Format a mention for card messages.
 */
export function formatMentionForCard(userId: string, name?: string): string {
  return `<at id="${userId}">${name || userId}</at>`;
}

/**
 * Format @all mention for text messages.
 */
export function formatMentionAllForText(): string {
  return `<at user_id="all">所有人</at>`;
}

/**
 * Format @all mention for card messages.
 */
export function formatMentionAllForCard(): string {
  return `<at id="all">所有人</at>`;
}

/**
 * Build a message with mentions prepended.
 */
export function buildMentionedMessage(
  text: string,
  mentions: MentionTarget[]
): string {
  const mentionStr = mentions
    .map((m) => formatMentionForText(m.userId, m.name))
    .join(" ");
  return mentionStr ? `${mentionStr} ${text}` : text;
}

/**
 * Build card content with mentions.
 */
export function buildMentionedCardContent(
  cardContent: any,
  mentions: MentionTarget[]
): any {
  // For cards, mentions are typically handled in the card JSON structure
  return cardContent;
}
