/**
 * footer-config.ts — default values and resolution logic for reply card footer metadata
 */

export interface FeishuFooterConfig {
  status?: boolean;
  elapsed?: boolean;
}

export const DEFAULT_FOOTER_CONFIG: Required<FeishuFooterConfig> = {
  status: false,
  elapsed: false,
};

export function resolveFooterConfig(cfg?: FeishuFooterConfig): Required<FeishuFooterConfig> {
  if (!cfg) return { ...DEFAULT_FOOTER_CONFIG };
  return {
    status: cfg.status ?? DEFAULT_FOOTER_CONFIG.status,
    elapsed: cfg.elapsed ?? DEFAULT_FOOTER_CONFIG.elapsed,
  };
}
