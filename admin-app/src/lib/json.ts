// Content files are stored as 2-space JSON with a trailing newline.
// JSON.stringify keeps insertion order, so edits never reorder keys.
export function serializeContent(data: unknown): string {
  return JSON.stringify(data, null, 2) + '\n';
}
