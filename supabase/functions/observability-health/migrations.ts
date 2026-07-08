export type MigrationComparison = {
  applied: Array<string>;
  expected: Array<string>;
  missing: Array<string>;
  extra: Array<string>;
  latestApplied: string | null;
  latestExpected: string | null;
};

export function migrationVersionFromPath(path: string): string | null {
  const fileName = path.split("/").pop() ?? path;
  if (!fileName.endsWith(".sql")) return null;

  const baseName = fileName.slice(0, -4);
  const separatorIndex = baseName.indexOf("_");
  const version = separatorIndex >= 0
    ? baseName.slice(0, separatorIndex)
    : baseName;

  return version.trim() || null;
}

export function compareMigrations(args: {
  applied: Array<string>;
  expected: Array<string>;
}): MigrationComparison {
  const applied = Array.from(new Set(args.applied.filter(Boolean))).sort();
  const expected = Array.from(new Set(args.expected.filter(Boolean))).sort();
  const appliedSet = new Set(applied);
  const expectedSet = new Set(expected);

  return {
    applied,
    expected,
    missing: expected.filter((version) => !appliedSet.has(version)),
    extra: applied.filter((version) => !expectedSet.has(version)),
    latestApplied: applied.at(-1) ?? null,
    latestExpected: expected.at(-1) ?? null,
  };
}
