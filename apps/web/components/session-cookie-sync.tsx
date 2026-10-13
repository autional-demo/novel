"use client";

import { useEffect } from "react";
import { useAutionalContext } from "@autional/react";
import { setSessionCookie, clearSessionCookie } from "@/lib/session-cookie";
import { setAutionalClient } from "@/lib/autional-client";

export function SessionCookieSync() {
  const { autional } = useAutionalContext();

  useEffect(() => {
    setAutionalClient(autional);
    let cancelled = false;

    const sync = () => {
      autional
        .getAccessToken()
        .then((token) => {
          if (!cancelled && token) setSessionCookie(token);
        })
        .catch(() => {});
    };
    const clear = () => {
      if (!cancelled) clearSessionCookie();
    };

    const unsubReady = autional.on("READY", sync);
    const unsubUser = autional.on("USER_CHANGED", sync);
    const unsubToken = autional.on("TOKEN_CHANGED", sync);
    const unsubLogout = autional.on("LOGGED_OUT", clear);
    sync();

    return () => {
      cancelled = true;
      unsubReady();
      unsubUser();
      unsubToken();
      unsubLogout();
    };
  }, [autional]);

  return null;
}
