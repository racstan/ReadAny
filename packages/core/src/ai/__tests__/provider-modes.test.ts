import { describe, expect, it } from "vitest";
import {
  DirectApiProviderMode,
  OpenCodeProviderMode,
  PiProviderMode,
  ProviderModeRegistry,
  providerModeRegistry,
} from "../modes";
import {
  PROVIDER_CONFIGS,
  detectProviderFromUrl,
  providerRequiresApiKey,
} from "../../utils/api";

describe("Provider Modes Architecture", () => {
  it("resolves the correct mode handler by provider string", () => {
    expect(providerModeRegistry.forProvider("opencode").mode).toBe("opencode");
    expect(providerModeRegistry.forProvider("opencode-go").mode).toBe("normal");
    expect(providerModeRegistry.forProvider("nvidia").mode).toBe("normal");
    expect(providerModeRegistry.forProvider("pi").mode).toBe("pi");
    expect(providerModeRegistry.forProvider("openai").mode).toBe("normal");
    expect(providerModeRegistry.forProvider("anthropic").mode).toBe("normal");
    expect(providerModeRegistry.forProvider("custom").mode).toBe("normal");
  });

  it("resolves the correct mode handler by mode name", () => {
    expect(providerModeRegistry.forMode("opencode")).toBeInstanceOf(OpenCodeProviderMode);
    expect(providerModeRegistry.forMode("pi")).toBeInstanceOf(PiProviderMode);
    expect(providerModeRegistry.forMode("normal")).toBeInstanceOf(DirectApiProviderMode);
  });

  describe("OpenCodeProviderMode", () => {
    const mode = new OpenCodeProviderMode();

    it("normalizes model names with opencode/ prefix", () => {
      expect(mode.normalizeModel("mimo-v2.6-flash-free")).toBe("opencode/mimo-v2.6-flash-free");
      expect(mode.normalizeModel("opencode/mimo-v2.6-flash-free")).toBe("opencode/mimo-v2.6-flash-free");
      expect(mode.normalizeModel("other-org/some-model")).toBe("other-org/some-model");
      expect(mode.normalizeModel("")).toBe("opencode/mimo-v2.6-flash-free");
    });

    it("reports free and local capabilities", () => {
      const caps = mode.defaultCapabilities();
      expect(caps.free).toBe(true);
      expect(caps.local).toBe(true);
      expect(caps.streaming).toBe(true);
      expect(caps.tool_calls).toBe(true);
    });

    it("provides helpful diagnostics when proxy is down", () => {
      const err = new Error("Failed to fetch: ECONNREFUSED");
      const diag = mode.failureDiagnostic(err);
      expect(diag).toContain("The local OpenCode proxy is unavailable");
      expect(diag).toContain("http://localhost:4010/v1");
    });

    it("diagnoses OpenCode free tier usage restrictions", () => {
      const err = new Error("Error: OpenCode's free tier can only be used from within OpenCode");
      const diag = mode.failureDiagnostic(err);
      expect(diag).toContain("OpenCode's free tier requires connection through the local OpenCode TUI");
    });
  });

  describe("PiProviderMode", () => {
    const mode = new PiProviderMode();

    it("resolves default model and normalizes cleanly", () => {
      expect(mode.defaultModel()).toBe("anthropic/claude-sonnet-4-20250514");
      expect(mode.normalizeModel("openai/gpt-4o")).toBe("openai/gpt-4o");
      expect(mode.normalizeModel("")).toBe("anthropic/claude-sonnet-4-20250514");
    });

    it("reports free and local capabilities", () => {
      const caps = mode.defaultCapabilities();
      expect(caps.free).toBe(true);
      expect(caps.local).toBe(true);
      expect(caps.streaming).toBe(true);
    });

    it("provides helpful diagnostics when Pi service is down", () => {
      const err = new Error("Cannot reach http://localhost:31415/v1: ECONNREFUSED");
      const diag = mode.failureDiagnostic(err);
      expect(diag).toContain("The local Pi agent service is unreachable");
      expect(diag).toContain("http://localhost:31415/v1");
    });
  });

  describe("API Config & Detection", () => {
    it("has opencode and pi in PROVIDER_CONFIGS", () => {
      expect(PROVIDER_CONFIGS.opencode).toBeDefined();
      expect(PROVIDER_CONFIGS.opencode.defaultBaseUrl).toBe("http://localhost:4010/v1");
      expect(PROVIDER_CONFIGS.pi).toBeDefined();
      expect(PROVIDER_CONFIGS.pi.defaultBaseUrl).toBe("http://localhost:31415/v1");
    });

    it("has NVIDIA NIM and OpenCode Go direct-API providers", () => {
      expect(PROVIDER_CONFIGS.nvidia).toBeDefined();
      expect(PROVIDER_CONFIGS.nvidia.defaultBaseUrl).toBe("https://integrate.api.nvidia.com/v1");
      expect(PROVIDER_CONFIGS["opencode-go"]).toBeDefined();
      expect(PROVIDER_CONFIGS["opencode-go"].defaultBaseUrl).toBe(
        "https://opencode.ai/inference/go/openai/v1",
      );
      expect(providerRequiresApiKey("nvidia")).toBe(true);
      expect(providerRequiresApiKey("opencode-go")).toBe(true);
    });

    it("detects NVIDIA NIM and OpenCode Go from their URLs", () => {
      expect(detectProviderFromUrl("https://integrate.api.nvidia.com/v1")).toBe("nvidia");
      expect(detectProviderFromUrl("https://opencode.ai/inference/go/openai/v1")).toBe(
        "opencode-go",
      );
      expect(detectProviderFromUrl("http://localhost:4010/v1")).toBe("opencode");
    });

    it("does not require API keys for local opencode and pi endpoints", () => {
      expect(providerRequiresApiKey("opencode")).toBe(false);
      expect(providerRequiresApiKey("pi")).toBe(false);
      expect(providerRequiresApiKey("ollama")).toBe(false);
      expect(providerRequiresApiKey("openai")).toBe(true);
    });

    it("detects opencode and pi from typical local URLs", () => {
      expect(detectProviderFromUrl("http://localhost:4010/v1")).toBe("opencode");
      expect(detectProviderFromUrl("http://localhost:4096")).toBe("opencode");
      expect(detectProviderFromUrl("http://127.0.0.1:4010/v1")).toBe("opencode");
      expect(detectProviderFromUrl("http://localhost:31415/v1")).toBe("pi");
      expect(detectProviderFromUrl("https://pi.dev/api")).toBe("pi");
    });
  });
});
