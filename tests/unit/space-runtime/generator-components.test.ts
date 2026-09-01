import { describe, expect, it } from "vitest";
import { collaborationInstructions } from "../../../apps/space-runtime/src/generator";
import { getCurrentSpaceAppComponentManagedRelease } from "@vibechat/space-app-components/node";

describe("Space App generator component guidance", () => {
  it("prefers public component domains while preserving immutable dependency pins", () => {
    const release = getCurrentSpaceAppComponentManagedRelease();
    const instructions = collaborationInstructions();

    for (const subpath of [
      "/core",
      "/foundation",
      "/user",
      "/chat",
      "/agent",
      "/recipes",
    ]) {
      expect(instructions).toContain(`'${release.name}${subpath}'`);
    }

    expect(instructions).toContain(`'${release.version}'`);
    expect(instructions).toContain(`"integrity": "${release.integrity}"`);
    expect(instructions).toContain("Keep Template code focused on layout, theme, copy, scene state");
    expect(instructions).toContain("never copy component source");
    expect(instructions).toContain("Never import a Registry artifact path");
  });
});
