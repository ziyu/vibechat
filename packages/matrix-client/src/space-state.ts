export function spaceIdFromStateContent(
  content: Record<string, unknown> | undefined,
) {
  const spaceId = content?.spaceId
  if (typeof spaceId === 'string') return spaceId

  // v1 rooms exist with both legacy field names. Both values identify the
  // originating market Template; Product metadata is enrichment, not a
  // prerequisite for projecting the live Space.
  const templateId = content?.templateId
  return typeof templateId === 'string' ? templateId : null
}
