import { describe, it, expect } from "vitest";
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES, RTL_LANGUAGES } from "../src/lib/languages";

describe("multilingual assistant config", () => {
  it("exposes the seven required demo languages", () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(codes).toEqual(["en", "es", "fr", "pt", "ar", "hi", "ja"]);
  });

  it("maps every code to a display name", () => {
    for (const l of SUPPORTED_LANGUAGES) {
      expect(LANGUAGE_NAMES[l.code]).toBe(l.name);
    }
  });

  it("marks Arabic as RTL", () => {
    expect(RTL_LANGUAGES.has("ar")).toBe(true);
    expect(RTL_LANGUAGES.has("en")).toBe(false);
  });
});
