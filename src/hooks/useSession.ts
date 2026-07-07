import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface SessionInfo {
  token: string;
  proxy_port: number;
  ws_port: number;
}

export function useSession(): SessionInfo | null {
  const [session, setSession] = useState<SessionInfo | null>(null);

  useEffect(() => {
    let attempts = 0;
    const tryInit = (): void => {
      invoke<SessionInfo>("get_session_token")
        .then(setSession)
        .catch(() => {
          if (attempts < 2) {
            attempts++;
            setTimeout(tryInit, 500);
          }
        });
    };
    tryInit();
  }, []);

  return session;
}
