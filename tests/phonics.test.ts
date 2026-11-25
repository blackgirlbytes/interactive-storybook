import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ chatJSON: vi.fn() }));
vi.mock("@/lib/server/fal", () => ({ ConfigError: class extends Error {}, chatJSON: mocks.chatJSON }));
import { POST } from "@/app/api/phonics/route";

const ask = (body: unknown) => POST(new Request("http://localhost/api/phonics", { method: "POST", body: JSON.stringify(body) }));
afterEach(() => vi.resetAllMocks());

describe("phonics route", () => {
  it("returns a split whose letters spell the word", async () => {
    mocks.chatJSON.mockResolvedValue(JSON.stringify({ parts: [{ letters: "sh", say: "shh" }, { letters: "i", say: "ih" }, { letters: "p", say: "puh" }] }));
    const res = await ask({ word: "ship" });
    expect(res.status).toBe(200);
    expect((await res.json()).parts.map((p: { letters: string }) => p.letters).join("")).toBe("ship");
    expect(mocks.chatJSON.mock.calls[0][0]).toContain("English");
  });

  it("asks again when the letters don't spell the word", async () => {
    mocks.chatJSON
      .mockResolvedValueOnce(JSON.stringify({ parts: [{ letters: "ma", say: "ma" }] }))
      .mockResolvedValueOnce(JSON.stringify({ parts: [{ letters: "ma", say: "ma" }, { letters: "no", say: "no" }] }));
    const res = await ask({ word: "Mano", language: "es" });
    expect(res.status).toBe(200);
    expect(mocks.chatJSON).toHaveBeenCalledTimes(2);
    expect(mocks.chatJSON.mock.calls[0][0]).toContain("syllables");
  });

  it("rejects phrases and unknown languages", async () => {
    expect((await ask({ word: "two words" })).status).toBe(400);
    expect((await ask({ word: "cat", language: "xx" })).status).toBe(400);
    expect(mocks.chatJSON).not.toHaveBeenCalled();
  });
});
