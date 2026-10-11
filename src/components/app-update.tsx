import { useEffect, useState } from "react";
import { Button } from "./ui/button";

export function AppUpdate({ installed }: { installed: boolean }) {
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!installed) return;
    const controller = new AbortController();
    let checking = false;
    const check = async () => {
      if (document.visibilityState !== "visible" || checking) return;
      checking = true;
      try {
        const response = await fetch("/version.json", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted) {
          setAvailable(
            typeof data === "object" &&
              data !== null &&
              "version" in data &&
              typeof data.version === "string" &&
              data.version.length > 0 &&
              data.version !== import.meta.env.VITE_APP_VERSION,
          );
        }
      } catch {
        // Offline or a failed deployment check: try again when the app returns.
      } finally {
        checking = false;
      }
    };
    void check();
    const interval = window.setInterval(check, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
    };
  }, [installed]);

  if (!installed || !available || dismissed) return null;
  return (
    <aside className="border-b bg-secondary px-4 py-3" aria-label="App update">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
        <div role="status">
          <p className="font-medium">A new version is available</p>
          <p className="text-sm text-muted-foreground">
            Save any edits before reloading.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => window.location.reload()}>
            Reload to update
          </Button>
          <Button variant="ghost" onClick={() => setDismissed(true)}>
            Dismiss
          </Button>
        </div>
      </div>
    </aside>
  );
}
