/** Normalizes separators and strips a leading "./" so paths compare cleanly. */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * Rewrites an absolute path reported by an AI tool into a project-relative one,
 * so it can be compared against the plan's paths and git's output.
 *
 * @param filePath Path as reported by the tool (usually absolute)
 * @param projectRoot Root the edit session is scoped to
 * @returns The path relative to the root, or the normalized input when outside it
 */
export function toProjectRelative(filePath: string, projectRoot: string): string {
  const file = normalizePath(filePath);
  const root = normalizePath(projectRoot).replace(/\/+$/, "");
  if (!root) return file;

  const prefix = `${root}/`;
  if (file.toLowerCase().startsWith(prefix.toLowerCase())) {
    return file.slice(prefix.length);
  }

  // Tolerate a root recorded without its drive letter ("\Users\…"), which is a
  // valid Windows directory but never prefixes the absolute paths tools report.
  const bare = stripDrive(prefix);
  const bareFile = stripDrive(file);
  if (bare && bareFile.toLowerCase().startsWith(bare.toLowerCase())) {
    return bareFile.slice(bare.length);
  }

  return file;
}

/** Drops a leading "C:" so paths differing only by drive prefix can compare. */
function stripDrive(p: string): string {
  return p.replace(/^[a-zA-Z]:/, "");
}
