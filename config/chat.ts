import {
  officialSpaceTemplateMarketEntries,
  type SpaceTemplateMarketEntry,
} from "@vibechat/space-templates";

/**
 * Compatibility export for consumers that still obtain the catalog through
 * configuration. The canonical protocol lives in @vibechat/space-templates.
 */
export type PublishedSpaceTemplateCatalogEntry = SpaceTemplateMarketEntry;

export const publishedSpaceTemplateCatalog: readonly PublishedSpaceTemplateCatalogEntry[] =
  officialSpaceTemplateMarketEntries;

export function getPublishedSpaceTemplate(templateId: string) {
  return publishedSpaceTemplateCatalog.find((template) => template.id === templateId) ?? null;
}
