export interface BuiltInChatSpaceConfig {
  spaceId: string;
  spaceVersionId: string;
  semanticVersion: string;
  integrity: string;
  permissions: string[];
  networkDomains: string[];
}

export const builtInChatSpaces: BuiltInChatSpaceConfig[] = [
  {
    spaceId: "space-campfire",
    spaceVersionId: "builtin-space-campfire-v1",
    semanticVersion: "1.0.0",
    integrity: "builtin:space-campfire@1.0.0",
    permissions: ["messages.read", "messages.send", "members.read", "interactions.send"],
    networkDomains: [],
  },
  {
    spaceId: "space-focus",
    spaceVersionId: "builtin-space-focus-v1",
    semanticVersion: "1.0.0",
    integrity: "builtin:space-focus@1.0.0",
    permissions: ["messages.read", "messages.send", "members.read", "state.shared.write"],
    networkDomains: [],
  },
  {
    spaceId: "space-arcade",
    spaceVersionId: "builtin-space-arcade-v1",
    semanticVersion: "1.0.0",
    integrity: "builtin:space-arcade@1.0.0",
    permissions: ["messages.read", "messages.send", "members.read", "interactions.send"],
    networkDomains: [],
  },
  {
    spaceId: "space-postcard",
    spaceVersionId: "builtin-space-postcard-v1",
    semanticVersion: "1.0.0",
    integrity: "builtin:space-postcard@1.0.0",
    permissions: ["messages.read", "messages.send", "members.read", "state.shared.write"],
    networkDomains: [],
  },
];

export function getBuiltInChatSpace(spaceId: string) {
  return builtInChatSpaces.find((space) => space.spaceId === spaceId) || null;
}
