import { describe, it, expect } from "vitest";

import { ensureArray } from "../../src/utils/ensure-array.js";

describe("ensureArray", () => {
  it("retorna [] para null", () => {
    expect(ensureArray<number>(null)).toEqual([]);
  });

  it("retorna [] para undefined", () => {
    expect(ensureArray<number>(undefined)).toEqual([]);
  });

  it("envolve valor único em array", () => {
    expect(ensureArray("x")).toEqual(["x"]);
    expect(ensureArray(0)).toEqual([0]);
    expect(ensureArray(false)).toEqual([false]);
  });

  it("retorna o próprio array quando já é array", () => {
    const arr = [1, 2, 3];
    expect(ensureArray(arr)).toBe(arr);
  });
});
