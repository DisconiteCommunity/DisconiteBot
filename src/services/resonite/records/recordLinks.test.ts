import { describe, it, expect } from "vitest";
import {
  buildOpenInResoniteUrl,
  openInResoniteRecordButtonLabel,
  parseRecordInput,
} from "./recordLinks.js";

describe("parseRecordInput", () => {
  it("parses resrec with three slashes", () => {
    const result = parseRecordInput(
      "resrec:///U-ProbablePrime/R-9ce872e1-ffb8-4194-bb91-3d3ab5f157a1",
    );
    expect(result).toEqual({
      ok: true,
      value: {
        kind: "record",
        ownerId: "U-ProbablePrime",
        recordId: "R-9ce872e1-ffb8-4194-bb91-3d3ab5f157a1",
      },
    });
  });

  it("parses resrec with two slashes", () => {
    const result = parseRecordInput(
      "resrec://U-Test/R-11111111-1111-1111-1111-111111111111",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        kind: "record",
        ownerId: "U-Test",
        recordId: "R-11111111-1111-1111-1111-111111111111",
      });
    }
  });

  it("parses open/world URL", () => {
    const result = parseRecordInput(
      "https://api.resonite.com/open/world/U-abc/R-11111111-1111-1111-1111-111111111111",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.kind).toBe("record");
    }
  });

  it("parses open/session with S-", () => {
    const result = parseRecordInput(
      "https://api.resonite.com/open/session/S-eea1442e-0ff2-4d6a-ad16-2dac9ea786fc",
    );
    expect(result).toEqual({
      ok: true,
      value: {
        kind: "session",
        sessionId: "S-eea1442e-0ff2-4d6a-ad16-2dac9ea786fc",
      },
    });
  });

  it("parses go.resonite.com/session/…", () => {
    const result = parseRecordInput(
      "https://go.resonite.com/session/S-019e288c-f2bc-7e7e-ab9e-6d0b7b1ad8db",
    );
    expect(result).toEqual({
      ok: true,
      value: {
        kind: "session",
        sessionId: "S-019e288c-f2bc-7e7e-ab9e-6d0b7b1ad8db",
      },
    });
  });

  it("parses ressession:/// with S-", () => {
    const result = parseRecordInput(
      "ressession:///S-019e288c-f2bc-7e7e-ab9e-6d0b7b1ad8db",
    );
    expect(result).toEqual({
      ok: true,
      value: {
        kind: "session",
        sessionId: "S-019e288c-f2bc-7e7e-ab9e-6d0b7b1ad8db",
      },
    });
  });

  it("parses Resonite:?world= with encoded resrec", () => {
    const result = parseRecordInput(
      "Resonite:?world=resrec%3A%2F%2F%2FU-X%2FR-11111111-1111-1111-1111-111111111111",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({ kind: "record", ownerId: "U-X" });
    }
  });

  it("extracts from wiki-like surrounding text", () => {
    const result = parseRecordInput(
      "See https://api.resonite.com/open/world/G-Resonite/R-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee for details.",
    );
    expect(result.ok).toBe(true);
    if (result.ok && result.value.kind === "record") {
      expect(result.value.ownerId).toBe("G-Resonite");
    }
  });

  it("classifies multi-segment path without R- id", () => {
    const result = parseRecordInput("resrec:///U-abc/Inventory/Items");
    expect(result).toEqual({
      ok: true,
      value: { kind: "path", ownerId: "U-abc", path: "Inventory/Items" },
    });
  });

  it("fails on empty", () => {
    const result = parseRecordInput("   ");
    expect(result.ok).toBe(false);
  });
});

describe("buildOpenInResoniteUrl", () => {
  it("encodes owner and record", () => {
    expect(buildOpenInResoniteUrl("U-a b", "R-x")).toBe(
      "https://api.resonite.com/open/world/U-a%20b/R-x",
    );
  });
});

describe("openInResoniteRecordButtonLabel", () => {
  it("maps record types to action labels", () => {
    expect(openInResoniteRecordButtonLabel("world")).toBe("Open world");
    expect(openInResoniteRecordButtonLabel("object")).toBe("Spawn item");
    expect(openInResoniteRecordButtonLabel("directory")).toBe("Open folder");
    expect(openInResoniteRecordButtonLabel("texture")).toBe("Open in Resonite");
  });
});
