import { describe, expect, it } from "vitest";
import {
  resoniteRichTextToDiscordPlain,
  stripResoniteRichText,
} from "./resoniteRichText.js";

describe("resoniteRichTextToDiscordPlain", () => {
  it("maps b i u s to Discord markdown", () => {
    expect(
      resoniteRichTextToDiscordPlain("<b>B</b> <i>I</i> <u>U</u> <s>S</s>"),
    ).toBe("**B** *I* __U__ ~~S~~");
  });

  it("normalizes br to newlines", () => {
    expect(resoniteRichTextToDiscordPlain("a<br>b<BR/>c")).toBe("a\nb\nc");
  });

  it("strips color but keeps inner text", () => {
    expect(resoniteRichTextToDiscordPlain("Hi <color=red>there</color>!")).toBe(
      "Hi there!",
    );
  });

  it("preserves noparse inner angle brackets", () => {
    expect(
      resoniteRichTextToDiscordPlain(
        "x<noparse><color>y</color></noparse>z",
      ),
    ).toBe("x<color>y</color>z");
  });

  it("removes closeall tags", () => {
    expect(resoniteRichTextToDiscordPlain("a</closeall>b")).toBe("ab");
  });
});

describe("stripResoniteRichText", () => {
  it("removes tags without adding markdown", () => {
    expect(stripResoniteRichText("<b>hi</b>")).toBe("hi");
  });

  it("removes sprite and similar self-closing tags", () => {
    expect(stripResoniteRichText("<sprite name=test>hi")).toBe("hi");
  });
});
