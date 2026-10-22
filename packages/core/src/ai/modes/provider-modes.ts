import type { AIMode, AIProviderType } from "../../types";

/**
 * Contract for AI provider mode handlers (Direct API, OpenCode, Pi).
 * Modeled after ForgeEdge's ProviderModeInterface architecture.
 */
export interface ProviderModeInterface {
  readonly mode: AIMode;
  matches(provider: string): boolean;
  normalizeModel(model: string, provider?: string): string;
  defaultModel(): string;
  defaultBaseUrl(): string;
  defaultModels(): string[];
  defaultCapabilities(): {
    text: boolean;
    streaming: boolean;
    tool_calls: boolean;
    vision: boolean;
    free: boolean;
    local: boolean;
  };
  failureDiagnostic(error: unknown): string | null;
}

/**
 * Handles standard Direct API / SDK cloud & local providers
 * (OpenAI, Anthropic, Gemini, Groq, DeepSeek, Ollama, LM Studio, etc.).
 */
export class DirectApiProviderMode implements ProviderModeInterface {
  readonly mode: AIMode = "normal";

  matches(provider: string): boolean {
    return provider !== "opencode" && provider !== "pi" && !provider.startsWith("opencode");
  }

  normalizeModel(model: string): string {
    return (model || "").trim();
  }

  defaultModel(): string {
    return "gpt-4o";
  }

  defaultBaseUrl(): string {
    return "https://api.openai.com";
  }

  defaultModels(): string[] {
    return [
      "gpt-4o",
      "gpt-4o-mini",
      "claude-sonnet-4-20250514",
      "gemini-2.0-flash",
      "deepseek-chat",
    ];
  }

  defaultCapabilities() {
    return {
      text: true,
      streaming: true,
      tool_calls: true,
      vision: true,
      free: false,
      local: false,
    };
  }

  failureDiagnostic(error: unknown): string | null {
    if (!error) return null;
    const msg = error instanceof Error ? error.message : String(error);
    if (
      msg.includes("401") ||
      msg.includes("Incorrect API key") ||
      msg.includes("Unauthorized") ||
      msg.includes("invalid_api_key")
    ) {
      return "Invalid API key or unauthorized request. Please verify your API key in AI settings.";
    }
    return null;
  }
}

/**
 * Handles OpenCode local proxy & bridge mode.
 * OpenCode proxy runs on port 4010 (/v1/*) when the OpenCode TUI is active,
 * and the OpenCode bridge runs on port 4096 (exposing /session, /provider).
 * Supports free OpenCode Zen models without billing.
 */
export class OpenCodeProviderMode implements ProviderModeInterface {
  readonly mode: AIMode = "opencode";

  matches(provider: string): boolean {
    return provider === "opencode" || provider.startsWith("opencode");
  }

  normalizeModel(model: string): string {
    const trimmed = (model || "").trim();
    if (!trimmed) return this.defaultModel();
    if (trimmed.includes("/")) return trimmed;
    return `opencode/${trimmed}`;
  }

  defaultModel(): string {
    return "opencode/mimo-v2.6-flash-free";
  }

  defaultBaseUrl(): string {
    return "http://localhost:4010/v1";
  }

  defaultBridgeUrl(): string {
    return "http://localhost:4096";
  }

  defaultModels(): string[] {
    return [
      "opencode/mimo-v2.6-flash-free",
      "opencode/deepseek-v4.1-flash-free",
      "opencode/glm-5.3-flash-free",
      "opencode/deepseek-v4-flash-free",
      "opencode/kimi-k2.5-flash-free",
      "opencode/qwen-2.5-coder-32b-free",
    ];
  }

  defaultCapabilities() {
    return {
      text: true,
      streaming: true,
      tool_calls: true,
      vision: true,
      free: true,
      local: true,
    };
  }

  failureDiagnostic(error: unknown): string | null {
    if (!error) return null;
    const msg = error instanceof Error ? error.message : String(error);
    if (
      msg.includes("Failed to fetch") ||
      msg.includes("ECONNREFUSED") ||
      msg.includes("Cannot reach") ||
      msg.includes("NetworkError") ||
      msg.includes("connection refused")
    ) {
      return (
        "The local OpenCode proxy is unavailable at http://localhost:4010/v1. " +
        "Start the OpenCode TUI in your terminal (`opencode`) to expose the OpenAI-compatible proxy, " +
        "or run `opencode serve` for the bridge."
      );
    }
    if (msg.includes("only be used from within OpenCode")) {
      return (
        "OpenCode's free tier requires connection through the local OpenCode TUI / proxy. " +
        "Ensure your OpenCode CLI is up-to-date (`npm install -g @opencode/cli@latest`) and running."
      );
    }
    return null;
  }
}

/**
 * Handles Pi local RPC / Agent bridge mode.
 * Connects to the Pi agent service at http://localhost:31415/v1.
 */
export class PiProviderMode implements ProviderModeInterface {
  readonly mode: AIMode = "pi";

  matches(provider: string): boolean {
    return provider === "pi";
  }

  normalizeModel(model: string): string {
    const trimmed = (model || "").trim();
    return trimmed || this.defaultModel();
  }

  defaultModel(): string {
    return "anthropic/claude-sonnet-4-20250514";
  }

  defaultBaseUrl(): string {
    return "http://localhost:31415/v1";
  }

  defaultModels(): string[] {
    return [
      "anthropic/claude-sonnet-4-20250514",
      "anthropic/claude-3-7-sonnet-20250219",
      "anthropic/claude-3-5-sonnet-20241022",
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
      "google/gemini-2.0-flash",
      "deepseek/deepseek-chat",
    ];
  }

  defaultCapabilities() {
    return {
      text: true,
      streaming: true,
      tool_calls: true,
      vision: false,
      free: true,
      local: true,
    };
  }

  failureDiagnostic(error: unknown): string | null {
    if (!error) return null;
    const msg = error instanceof Error ? error.message : String(error);
    if (
      msg.includes("Failed to fetch") ||
      msg.includes("ECONNREFUSED") ||
      msg.includes("Cannot reach") ||
      msg.includes("NetworkError") ||
      msg.includes("connection refused")
    ) {
      return (
        "The local Pi agent service is unreachable at http://localhost:31415/v1. " +
        "Make sure the Pi CLI or bridge process is running."
      );
    }
    return null;
  }
}

/**
 * Registry resolving mode handlers and providers.
 */
export class ProviderModeRegistry {
  private modes: ProviderModeInterface[];

  constructor(modes?: ProviderModeInterface[]) {
    this.modes = modes || [
      new OpenCodeProviderMode(),
      new PiProviderMode(),
      new DirectApiProviderMode(),
    ];
  }

  forProvider(provider: string): ProviderModeInterface {
    for (const mode of this.modes) {
      if (mode.matches(provider)) {
        return mode;
      }
    }
    return this.modes[2]; // Fallback to DirectApiProviderMode
  }

  forMode(modeName?: AIMode): ProviderModeInterface {
    if (!modeName) return this.modes[2];
    for (const mode of this.modes) {
      if (mode.mode === modeName) {
        return mode;
      }
    }
    return this.modes[2];
  }

  getAllModes(): ProviderModeInterface[] {
    return [...this.modes];
  }
}

export const providerModeRegistry = new ProviderModeRegistry();
