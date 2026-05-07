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
    invoke<SessionInfo>("get_session_token").then(setSession);
  }, []);

  return session;
}
