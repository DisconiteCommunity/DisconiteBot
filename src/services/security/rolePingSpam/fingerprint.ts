import type { Collection, Message } from "discord.js";

export interface MessageFingerprintInput {
  authorId: string;
  content: string;
  roleIds: string[];
  imageUrls: string[];
}

export function countImageAttachments(
  attachments: Collection<string, { contentType: string | null; url: string }>,
): number {
  let count = 0;
  for (const attachment of attachments.values()) {
    if (attachment.contentType?.startsWith("image/")) {
      count++;
    }
  }
  return count;
}

export function getImageAttachmentUrls(
  attachments: Collection<string, { contentType: string | null; url: string }>,
): string[] {
  const urls: string[] = [];
  for (const attachment of attachments.values()) {
    if (attachment.contentType?.startsWith("image/")) {
      urls.push(attachment.url);
    }
  }
  urls.sort();
  return urls;
}

export function hasRoleMention(message: Pick<Message, "mentions">): boolean {
  return message.mentions.roles.size > 0;
}

export function buildMessageFingerprint(input: MessageFingerprintInput): string {
  const roleIds = [...input.roleIds].sort();
  const imageUrls = [...input.imageUrls].sort();
  return [
    input.authorId,
    input.content,
    imageUrls.join("\x1f"),
    roleIds.join("\x1f"),
  ].join("\x1e");
}

export function fingerprintFromMessage(message: Message): string | null {
  if (!hasRoleMention(message)) {
    return null;
  }

  const imageUrls = getImageAttachmentUrls(message.attachments);
  if (imageUrls.length === 0) {
    return null;
  }

  const roleIds = [...message.mentions.roles.keys()];
  return buildMessageFingerprint({
    authorId: message.author.id,
    content: message.content,
    roleIds,
    imageUrls,
  });
}

export function messageMeetsImageThreshold(
  message: Message,
  minImages: number,
): boolean {
  return countImageAttachments(message.attachments) >= minImages;
}
