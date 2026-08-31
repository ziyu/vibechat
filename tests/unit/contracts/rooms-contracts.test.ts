import { describe, expect, it } from "vitest";
import { createRoomRequestSchema } from "@vibechat/api-contracts";

const baseRequest = {
  participantUserIds: [],
  instanceConfig: {},
  clientRequestId: "client-request-123",
  name: "A Space",
};

describe("Room API contracts", () => {
  it("normalizes an explicit blank Space without Template lineage", () => {
    expect(createRoomRequestSchema.parse({
      ...baseRequest,
      startMode: "blank",
    })).toEqual({
      ...baseRequest,
      startMode: "blank",
      spaceTemplateId: null,
      spaceTemplateVersionId: null,
    });
  });

  it("normalizes canonical and legacy fixed Template references", () => {
    expect(createRoomRequestSchema.parse({
      ...baseRequest,
      startMode: "template",
      spaceTemplateId: "space-campfire",
      spaceTemplateVersionId: "tplv-space-campfire-0-1-2",
    })).toMatchObject({
      startMode: "template",
      spaceTemplateId: "space-campfire",
      spaceTemplateVersionId: "tplv-space-campfire-0-1-2",
    });
    expect(createRoomRequestSchema.parse({
      ...baseRequest,
      spaceId: "space-campfire",
    })).toMatchObject({
      startMode: "template",
      spaceTemplateId: "space-campfire",
      spaceTemplateVersionId: null,
    });
  });

  it("rejects blank Template refs, conflicting aliases, and unpinned canonical refs", () => {
    expect(createRoomRequestSchema.safeParse({
      ...baseRequest,
      startMode: "blank",
      spaceId: "space-default",
    }).success).toBe(false);
    expect(createRoomRequestSchema.safeParse({
      ...baseRequest,
      spaceId: "space-default",
      spaceTemplateId: "space-campfire",
      spaceTemplateVersionId: "tplv-space-campfire-0-1-2",
    }).success).toBe(false);
    expect(createRoomRequestSchema.safeParse({
      ...baseRequest,
      startMode: "template",
      spaceTemplateId: "space-campfire",
    }).success).toBe(false);
  });
});
