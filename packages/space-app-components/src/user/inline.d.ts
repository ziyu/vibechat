export interface SpaceUserInlineModule {
  readonly schemaVersion: "vibechat.space-component-inline-module/v1";
  readonly packageVersion: string;
  readonly sdkRange: string;
  readonly projectFormat: "agentos-app-v1";
  readonly sourceHash: `sha256:${string}`;
  readonly bundleHash: `sha256:${string}`;
  readonly source: string;
}

/**
 * Prebundled User browser module for an agentos-app-v1 Project that returns a
 * self-contained HTML document. Normal browser-bundled Apps should import the
 * semantic `@vibechat/space-app-components/user` entry instead.
 */
export declare const spaceUserInlineModule: Readonly<SpaceUserInlineModule>;
