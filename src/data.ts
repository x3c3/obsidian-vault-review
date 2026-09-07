export type PluginData = {
  schemaVersion: number;
  reviewedPaths: string[];
  reviewStartedAt?: string;
  excludedFolders: string[];
  showStatusBar: boolean;
};

export const CURRENT_SCHEMA_VERSION = 2;

export const DEFAULT_DATA: PluginData = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  reviewedPaths: [],
  excludedFolders: [],
  showStatusBar: true,
};

export type SavedData = Partial<PluginData>;

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/**
 * `data.json` is the least trustworthy thing the plugin reads: a hand-edit, a
 * sync conflict, or a schema written by a future version can put any shape in
 * it, and a spread happily overwrites a well-typed default with a wrong-typed
 * value. Coerce rather than throw — a bad field must degrade to its default so
 * the settings tab still renders and the user can repair it from the UI.
 */
export function normalizeData(raw: unknown): Omit<PluginData, "schemaVersion"> {
  const data = (typeof raw === "object" && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >;
  const startedAt = data.reviewStartedAt;

  return {
    reviewedPaths: stringArray(data.reviewedPaths),
    reviewStartedAt:
      typeof startedAt === "string" && !Number.isNaN(Date.parse(startedAt))
        ? startedAt
        : undefined,
    excludedFolders: stringArray(data.excludedFolders),
    showStatusBar:
      typeof data.showStatusBar === "boolean"
        ? data.showStatusBar
        : DEFAULT_DATA.showStatusBar,
  };
}
