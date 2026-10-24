import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_TTS_CONFIG, type TTSConfig } from "./types";

// fetchEdgeTTSAudio always resolves immediately so the consume loop quickly reaches
// decodeAndSchedule; timing gates are controlled by the decodeAudioData mock below.
vi.mock("./edge-tts", () => ({
  fetchEdgeTTSAudio: vi.fn(async () => new ArrayBuffer(8)),
}));

const { EdgeTTSPlayer } = await import("./tts-players");

// Collect a resolver for every decodeAudioData call so we can manually control when each run finishes decoding.
let decodeResolvers: Array<(buf: unknown) => void>;
let createdSources: Array<{
  stop: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
}>;

function installAudioMock() {
  decodeResolvers = [];
  createdSources = [];
  class MockAudioContext {
    state = "running";
    currentTime = 0;
    destination = {};
    createGain() {
      return { connect: vi.fn(), gain: { value: 1 } };
    }
    createBufferSource() {
      const source = {
        buffer: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      };
      createdSources.push(source);
      return source;
    }
    decodeAudioData() {
      return new Promise((resolve) => {
        decodeResolvers.push(resolve);
      });
    }
    resume() {
      return Promise.resolve();
    }
    suspend() {
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
  }
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext;
}

// Yield to the microtask queue repeatedly to push the awaited consume loop forward to the next gate.
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

const cfg: TTSConfig = { ...DEFAULT_TTS_CONFIG, engine: "edge" };

describe("EdgeTTSPlayer — per-run runId isolation (#372 reentrancy slice)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installAudioMock();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("a superseded run no longer fires onChunkChange after its decode completes", async () => {
    const player = new EdgeTTSPlayer();
    const onChunk = vi.fn();
    player.onChunkChange = onChunk;

    // Run A: parked in decodeAudioData (resolver[0]).
    player.speak(["a0"], cfg);
    await flush();
    expect(decodeResolvers.length).toBe(1);

    // Run B supersedes run A on the same instance; its decode (resolver[1]) stays pending, so run B does not fire onChunkChange.
    player.speak(["b0"], cfg);
    await flush();
    expect(decodeResolvers.length).toBe(2);

    // Only after run A has been superseded, let its decode complete.
    decodeResolvers[0]({ duration: 1 });
    await flush();

    // The old run must be fully deactivated — no progress callbacks may leak.
    expect(onChunk).not.toHaveBeenCalled();
  });

  it("after stop(), an in-flight decode of the old run no longer fires onChunkChange or schedules audio", async () => {
    const player = new EdgeTTSPlayer();
    const onChunk = vi.fn();
    player.onChunkChange = onChunk;

    // The run is parked in decodeAudioData (resolver[0]).
    player.speak(["a0"], cfg);
    await flush();
    expect(decodeResolvers.length).toBe(1);

    // stop() does not bump runId; it only sets _playing=false.
    player.stop();
    await flush();

    // Let the decode complete only after stop() — the continuation must bail at the guard via _playing=false.
    decodeResolvers[0]({ duration: 1 });
    await flush();

    expect(onChunk).not.toHaveBeenCalled();
  });

  it("stop() immediately stops an already scheduled audio source", async () => {
    const player = new EdgeTTSPlayer();

    player.speak(["a0"], cfg);
    await flush();
    expect(decodeResolvers.length).toBe(1);

    decodeResolvers[0]({ duration: 1 });
    await flush();
    expect(createdSources.length).toBe(1);

    player.stop();

    expect(createdSources[0].stop).toHaveBeenCalledTimes(1);
    expect(createdSources[0].disconnect).toHaveBeenCalledTimes(1);
  });

  it("a resume() rejection under re-entrancy does not surface as an unhandled rejection from speak()", async () => {
    class SuspendedRejectingCtx {
      state = "suspended";
      currentTime = 0;
      destination = {};
      createGain() {
        return { connect: vi.fn(), gain: { value: 1 } };
      }
      createBufferSource() {
        return { buffer: null, connect: vi.fn(), start: vi.fn() };
      }
      decodeAudioData() {
        return new Promise(() => {}); // never resolves
      }
      resume() {
        return Promise.reject(new Error("InvalidStateError"));
      }
      suspend() {
        return Promise.resolve();
      }
      close() {
        return Promise.resolve();
      }
    }
    (globalThis as unknown as { AudioContext: unknown }).AudioContext = SuspendedRejectingCtx;

    const player = new EdgeTTSPlayer();
    const p1 = player.speak(["a0"], cfg); // parked at await resume() (rejects)
    player.speak(["b0"], cfg); // supersedes run A, bumps runId
    await flush();
    await expect(p1).resolves.toBeUndefined(); // run A returns cleanly, no rejection
    player.stop();
  });
});
