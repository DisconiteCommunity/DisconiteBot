import { describe, it, expect } from "vitest";
import {
  buildOpenWorldUrl,
  parseRecordInput,
} from "./recordLinks.js";

describe("parseRecordInput", () => {
  it("parses resrec with three slashes", () => {
    const r = parseRecordInput(
      "resrec:///U-ProbablePrime/R-9ce872e1-ffb8-4194-bb91-3d3ab5f157a1",
    );
    expect(r).toEqual({
      ok: true,
      value: {
        kind: "record",
        ownerId: "U-ProbablePrime",
        recordId: "R-9ce872e1-ffb8-4194-bb91-3d3ab5f157a1",
      },
    });
  });

  it("parses resrec with two slashes", () => {
    const r = parseRecordInput(
      "resrec://U-Test/R-11111111-1111-1111-1111-111111111111",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toMatchObject({
        kind: "record",
        ownerId: "U-Test",
        recordId: "R-11111111-1111-1111-1111-111111111111",
      });
    }
  });

  it("parses open/world URL", () => {
    const r = parseRecordInput(
      "https://api.resonite.com/open/world/U-abc/R-11111111-1111-1111-1111-111111111111",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.kind).toBe("record");
    }
  });

  it("parses open/session with S-", () => {
    const r = parseRecordInput(
      "https://api.resonite.com/open/session/S-eea1442e-0ff2-4d6a-ad16-2dac9ea786fc",
    );
    expect(r).toEqual({
      ok: true,
      value: {
        kind: "session",
        sessionId: "S-eea1442e-0ff2-4d6a-ad16-2dac9ea786fc",
      },
    });
  });

  it("parses go.resonite.com/session/…", () => {
    const r = parseRecordInput(
      "https://go.resonite.com/session/S-019e288c-f2bc-7e7e-ab9e-6d0b7b1ad8db",
    );
    expect(r).toEqual({
      ok: true,
      value: {
        kind: "session",
        sessionId: "S-019e288c-f2bc-7e7e-ab9e-6d0b7b1ad8db",
      },
    });
  });

  it("parses ressession:/// with S-", () => {
    const r = parseRecordInput(
      "ressession:///S-019e288c-f2bc-7e7e-ab9e-6d0b7b1ad8db",
    );
    expect(r).toEqual({
      ok: true,
      value: {
        kind: "session",
        sessionId: "S-019e288c-f2bc-7e7e-ab9e-6d0b7b1ad8db",
      },
    });
  });

  it("parses Resonite:?world= with encoded resrec", () => {
    const r = parseRecordInput(
      "Resonite:?world=resrec%3A%2F%2F%2FU-X%2FR-11111111-1111-1111-1111-111111111111",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toMatchObject({ kind: "record", ownerId: "U-X" });
    }
  });

  it("extracts from wiki-like surrounding text", () => {
    const r = parseRecordInput(
      "See https://api.resonite.com/open/world/G-Resonite/R-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee for details.",
    );
    expect(r.ok).toBe(true);
    if (r.ok && r.value.kind === "record") {
      expect(r.value.ownerId).toBe("G-Resonite");
    }
  });

  it("classifies multi-segment path without R- id", () => {
    const r = parseRecordInput("resrec:///U-abc/Inventory/Items");
    expect(r).toEqual({
      ok: true,
      value: { kind: "path", ownerId: "U-abc", path: "Inventory/Items" },
    });
  });

  it("fails on empty", () => {
    const r = parseRecordInput("   ");
    expect(r.ok).toBe(false);
  });
});

describe("buildOpenWorldUrl", () => {
  it("encodes owner and record", () => {
    expect(buildOpenWorldUrl("U-a b", "R-x")).toBe(
      "https://api.resonite.com/open/world/U-a%20b/R-x",
    );
  });
});
