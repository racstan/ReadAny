import { describe, expect, it } from "vitest";
import { ThinkTagStreamParser } from "../think-tag-parser";

describe("ThinkTagStreamParser", () => {
  it("splits visible text and reasoning in a single chunk", () => {
    const parser = new ThinkTagStreamParser();

    const events = parser.push("start<think>check stats first</think>end");

    expect(events).toEqual([
      { type: "token", content: "start" },
      { type: "reasoning", content: "check stats first" },
      { type: "token", content: "end" },
    ]);
  });

  it("supports think tags split across streaming chunks", () => {
    const parser = new ThinkTagStreamParser();

    const events = [
      ...parser.push("<thi"),
      ...parser.push("nk>let me"),
      ...parser.push("organize this</th"),
      ...parser.push("ink>okay"),
      ...parser.flush(),
    ];

    expect(events).toEqual([
      { type: "reasoning", content: "let me" },
      { type: "reasoning", content: "organize this" },
      { type: "token", content: "okay" },
    ]);
  });

  it("keeps plain text untouched when no think tags exist", () => {
    const parser = new ThinkTagStreamParser();

    const events = [...parser.push("plain reply"), ...parser.flush()];

    expect(events).toEqual([{ type: "token", content: "plain reply" }]);
  });

  it("flushes unfinished reasoning blocks as reasoning content", () => {
    const parser = new ThinkTagStreamParser();

    const events = [...parser.push("<think>not yet closed"), ...parser.flush()];

    expect(events).toEqual([{ type: "reasoning", content: "not yet closed" }]);
  });
});
