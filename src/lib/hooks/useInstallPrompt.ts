import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function getStashed(): BeforeInstallPromptEvent | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { __installPromptEvent?: BeforeInstallPromptEvent })
    .__installPromptEvent;
}

/**
 * Exposes the captured `beforeinstallprompt` event so the UI can offer a
 * manual "Install app" button. The event is stashed very early in main.tsx
 * (Chrome only fires it once), and this hook syncs to it.
 *
 * `canInstall` is false when already installed, on iOS Safari (no event), or
 * before Chrome's engagement heuristics fire — in those cases the button
 * should be hidden.
 */
export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState<boolean>(() => !!getStashed());

  useEffect(() => {
    const sync = () => setCanInstall(!!getStashed());
    window.addEventListener("installable-change", sync);
    window.addEventListener("appinstalled", sync);
    sync();
    return () => {
      window.removeEventListener("installable-change", sync);
      window.removeEventListener("appinstalled", sync);
    };
  }, []);

  const promptInstall = async (): Promise<boolean> => {
    const ev = getStashed();
    if (!ev) return false;
    try {
      await ev.prompt();
      await ev.userChoice;
    } catch {
      // user dismissed or prompt already consumed
    }
    (window as unknown as { __installPromptEvent?: BeforeInstallPromptEvent })
      .__installPromptEvent = undefined;
    window.dispatchEvent(new Event("installable-change"));
    return true;
  };

  return { canInstall, promptInstall };
}
