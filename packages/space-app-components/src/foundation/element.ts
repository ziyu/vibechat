export type SpaceElementRegistry = Pick<CustomElementRegistry, "define" | "get">;

export function defineSpaceElement(
  registry: SpaceElementRegistry | undefined,
  name: string,
  createConstructor: () => CustomElementConstructor,
) {
  if (!registry || typeof globalThis.HTMLElement !== "function") return false;
  if (!registry.get(name)) registry.define(name, createConstructor());
  return true;
}
