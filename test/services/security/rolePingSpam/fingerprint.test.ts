import { describe, it, expect } from "vitest";
import {
  buildMessageFingerprint,
  countImageAttachments,
  fingerprintFromMessage,
  hasRoleMention,
} from "../../../../src/services/security/rolePingSpam/fingerprint.js";
import { Collection } from "discord.js";

function mockAttachment(contentType: string | null, url: string) {
  return { contentType, url };
}

function mockMessage(partial: {
  authorId: string;
  content: string;
  roleIds?: string[];
  attachments?: ReturnType<typeof mockAttachment>[];
}) {
  const roles = new Collection<string, { id: string }>();
  for (const roleId of partial.roleIds ?? []) {
    roles.set(roleId, { id: roleId });
  }
  const attachments = new Collection<string, ReturnType<typeof mockAttachment>>();
  for (const [index, attachment] of (partial.attachments ?? []).entries()) {
    attachments.set(String(index), attachment);
  }
  return {
    author: { id: partial.authorId },
    content: partial.content,
    mentions: { roles },
    attachments,
  } as Parameters<typeof fingerprintFromMessage>[0];
}

describe("fingerprint", () => {
  it("counts image attachments only", () => {
    const attachments = new Collection<string, ReturnType<typeof mockAttachment>>();
    attachments.set("1", mockAttachment("image/png", "https://a/1.png"));
    attachments.set("2", mockAttachment("application/pdf", "https://a/1.pdf"));
    attachments.set("3", mockAttachment("image/jpeg", "https://a/2.jpg"));
    expect(countImageAttachments(attachments)).toBe(2);
  });

  it("detects role mentions", () => {
    const withRole = mockMessage({ authorId: "u1", content: "hi", roleIds: ["r1"] });
    const withoutRole = mockMessage({ authorId: "u1", content: "hi" });
    expect(hasRoleMention(withRole)).toBe(true);
    expect(hasRoleMention(withoutRole)).toBe(false);
  });

  it("builds stable fingerprints regardless of role order", () => {
    const a = buildMessageFingerprint({
      authorId: "u1",
      content: "spam",
      roleIds: ["r2", "r1"],
      imageCount: 2,
    });
    const b = buildMessageFingerprint({
      authorId: "u1",
      content: "spam",
      roleIds: ["r1", "r2"],
      imageCount: 2,
    });
    expect(a).toBe(b);
  });

  it("matches cross-channel spam with different attachment URLs", () => {
    const channelA = fingerprintFromMessage(
      mockMessage({
        authorId: "u1",
        content: "<@&r1>",
        roleIds: ["r1"],
        attachments: [
          mockAttachment("image/png", "https://cdn.discordapp.com/attachments/ch1/a/image.png"),
          mockAttachment("image/png", "https://cdn.discordapp.com/attachments/ch1/b/image.png"),
        ],
      }),
    );
    const channelB = fingerprintFromMessage(
      mockMessage({
        authorId: "u1",
        content: "<@&r1>",
        roleIds: ["r1"],
        attachments: [
          mockAttachment("image/png", "https://cdn.discordapp.com/attachments/ch2/c/image.png"),
          mockAttachment("image/png", "https://cdn.discordapp.com/attachments/ch2/d/image.png"),
        ],
      }),
    );
    expect(channelA).toBe(channelB);
  });

  it("returns null when no role mention or no images", () => {
    expect(
      fingerprintFromMessage(
        mockMessage({ authorId: "u1", content: "x", roleIds: ["r1"] }),
      ),
    ).toBeNull();
    expect(
      fingerprintFromMessage(
        mockMessage({
          authorId: "u1",
          content: "x",
          attachments: [mockAttachment("image/png", "https://a/1.png")],
        }),
      ),
    ).toBeNull();
  });

  it("fingerprints messages with roles and images", () => {
    const fp = fingerprintFromMessage(
      mockMessage({
        authorId: "u1",
        content: "hello",
        roleIds: ["r1"],
        attachments: [
          mockAttachment("image/png", "https://a/1.png"),
          mockAttachment("image/png", "https://a/2.png"),
        ],
      }),
    );
    expect(fp).toContain("u1");
    expect(fp).toContain("hello");
  });
});
