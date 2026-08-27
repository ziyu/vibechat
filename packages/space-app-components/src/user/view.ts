import type { SpaceAppMember } from "@vibechat/space-app-sdk";
import { sanitizeSpaceMediaUrl } from "../foundation/safety.js";
import type { SpaceAvatarStatus } from "../foundation/avatar.js";

export interface SpaceUserIdentityView {
  readonly id: string;
  readonly name: string;
  readonly handle: string | null;
  readonly avatarUrl: string | null;
  readonly presence: SpaceAvatarStatus;
}

export function createSpaceUserIdentityView(
  member: SpaceAppMember,
): SpaceUserIdentityView {
  const handle = member.handle?.trim() || null;
  const name = member.displayName?.trim()
    || member.name?.trim()
    || handle
    || "Member";
  return Object.freeze({
    id: member.id,
    name,
    handle,
    avatarUrl: sanitizeSpaceMediaUrl(member.avatarUrl),
    presence: member.presence ?? "offline",
  });
}
