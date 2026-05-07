import type { JSX } from "react";
import type { UpdaterHook } from "@/hooks/useUpdater.js";

interface UpdateBannerProps {
  updater: UpdaterHook;
}

/**
 * @param props.updater - UpdaterHook state and actions
 * @returns Non-intrusive banner shown when an update is available
 */
export function UpdateBanner({ updater }: UpdateBannerProps): JSX.Element | null {
  const { update, installing, dismissed, install, dismiss } = updater;

  if (!update?.available || dismissed) return null;

  return (
    <div className="update-banner" role="status">
      <span className="update-banner__text">
        v{update.version} available
        {update.body ? ` — ${update.body}` : ""}
      </span>
      <div className="update-banner__actions">
        <button
          className="update-banner__btn update-banner__btn--primary"
          onClick={install}
          disabled={installing}
        >
          {installing ? "Installing..." : "Update"}
        </button>
        <button
          className="update-banner__btn"
          onClick={dismiss}
          disabled={installing}
        >
          Later
        </button>
      </div>
    </div>
  );
}
