"use client";

import { type Dispatch, type ReactNode, type SetStateAction, createContext } from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";
import { AutionalProvider } from "@autional/next";
import useLocalStorage from "@/hooks/use-local-storage";
import { AUTIONAL_APP_ID, AUTIONAL_ISSUER, getAutionalApiUrl } from "@/lib/autional";
import { SessionCookieSync } from "@/components/session-cookie-sync";

export const AppContext = createContext<{
  font: string;
  setFont: Dispatch<SetStateAction<string>>;
}>({
  font: "Default",
  setFont: () => {},
});

const ToasterProvider = () => {
  const { theme } = useTheme() as {
    theme: "light" | "dark" | "system";
  };
  return <Toaster theme={theme} />;
};

export default function Providers({ children }: { children: ReactNode }) {
  const [font, setFont] = useLocalStorage<string>("novel__font", "Default");

  return (
    <ThemeProvider attribute="class" enableSystem disableTransitionOnChange defaultTheme="system">
      <AppContext.Provider
        value={{
          font,
          setFont,
        }}
      >
        <AutionalProvider
          config={{
            appId: AUTIONAL_APP_ID,
            issuer: AUTIONAL_ISSUER,
            apiUrl: getAutionalApiUrl(),
          }}
        >
          <SessionCookieSync />
          <ToasterProvider />
          {children}
          <Analytics />
        </AutionalProvider>
      </AppContext.Provider>
    </ThemeProvider>
  );
}
