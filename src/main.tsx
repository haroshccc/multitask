import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import App from "./App";
import "./index.css";

// PWA install: Chrome fires `beforeinstallprompt` once, early — capture and
// stash it here (before React mounts) so an in-app "Install" button can call
// .prompt() later. `useInstallPrompt` reads window.__installPromptEvent and
// reacts to the "installable-change" event.
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  (window as unknown as { __installPromptEvent?: Event }).__installPromptEvent = e;
  window.dispatchEvent(new Event("installable-change"));
});
window.addEventListener("appinstalled", () => {
  (window as unknown as { __installPromptEvent?: Event }).__installPromptEvent = undefined;
  window.dispatchEvent(new Event("installable-change"));
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// PWA: register the service worker in production builds only (a dev SW
// would fight Vite's module server and serve stale modules).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failing (old browser, private mode) is non-fatal —
      // the app simply runs without offline support.
    });
  });
}
