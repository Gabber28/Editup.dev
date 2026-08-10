/**
 * How the folder typed in the setup screen relates to the app served at the
 * target origin.
 *
 * - `ok` — folder exists and the page resolves into it
 * - `not_found` — path is missing or is not a directory
 * - `mismatch` — folder exists but serves a different project
 * - `unverified` — folder exists and the page proves nothing either way
 */
export type RootVerdict = "ok" | "not_found" | "mismatch" | "unverified";

/** Result of `validate_project_root`, rendered in the setup screen banner. */
export interface RootCheck {
  verdict: RootVerdict;
  /** User-facing sentence; empty when the verdict is `ok`. */
  message: string;
}
