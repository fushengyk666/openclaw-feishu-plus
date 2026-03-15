/**
 * image-resolver.ts — best-effort markdown image URL → Feishu image key resolver
 */

import { uploadImageFeishu } from "./media.js";

const IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;

export async function fetchRemoteImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch image failed: HTTP ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

export class ImageResolver {
  private readonly resolved = new Map<string, string>();
  private readonly pending = new Map<string, Promise<string | null>>();
  private readonly failed = new Set<string>();

  constructor(
    private readonly opts: {
      cfg: any;
      accountId?: string;
      onImageResolved?: () => void;
      log?: { info?: (...args: any[]) => void; warn?: (...args: any[]) => void };
    },
  ) {}

  resolveImages(text: string): string {
    if (!text.includes("![")) return text;

    return text.replace(IMAGE_RE, (full, alt: string, value: string) => {
      if (value.startsWith("img_")) return full;
      if (!value.startsWith("http://") && !value.startsWith("https://")) return "";

      const cached = this.resolved.get(value);
      if (cached) return `![${alt}](${cached})`;
      if (this.failed.has(value)) return "";
      if (!this.pending.has(value)) this.pending.set(value, this.doUpload(value));
      return "";
    });
  }

  async resolveImagesAwait(text: string, timeoutMs = 15000): Promise<string> {
    this.resolveImages(text);
    if (this.pending.size > 0) {
      await Promise.race([
        Promise.allSettled([...this.pending.values()]),
        new Promise((resolve) => setTimeout(resolve, timeoutMs)),
      ]);
    }
    return this.resolveImages(text);
  }

  private async doUpload(url: string): Promise<string | null> {
    try {
      this.opts.log?.info?.(`image upload start: ${url}`);
      const buffer = await fetchRemoteImageBuffer(url);
      const imageKey = await uploadImageFeishu({
        cfg: this.opts.cfg,
        imageBuffer: buffer,
        imageType: "message",
        accountId: this.opts.accountId,
      });
      if (!imageKey) throw new Error("empty image_key");
      this.resolved.set(url, imageKey);
      this.pending.delete(url);
      this.opts.onImageResolved?.();
      this.opts.log?.info?.(`image upload done: ${url} -> ${imageKey}`);
      return imageKey;
    } catch (err) {
      this.pending.delete(url);
      this.failed.add(url);
      this.opts.log?.warn?.(`image upload failed: ${url} :: ${String(err)}`);
      return null;
    }
  }
}
