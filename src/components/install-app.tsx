import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "./ui/dialog";

interface InstallPrompt extends Event {
  prompt(): Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Listen at the app root: the browser may offer installation before Settings opens.
export function useInstallation() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const standalone = matchMedia("(display-mode: standalone)");
    const updateDisplay = () =>
      setInstalled(
        standalone.matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone ===
            true,
      );
    const offerInstall = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
      setError("");
    };
    const finishInstall = () => {
      setInstalled(true);
      setPrompt(null);
    };
    updateDisplay();
    standalone.addEventListener("change", updateDisplay);
    window.addEventListener("beforeinstallprompt", offerInstall);
    window.addEventListener("appinstalled", finishInstall);
    return () => {
      standalone.removeEventListener("change", updateDisplay);
      window.removeEventListener("beforeinstallprompt", offerInstall);
      window.removeEventListener("appinstalled", finishInstall);
    };
  }, []);
  const install = async () => {
    if (!prompt) return;
    setPrompt(null);
    setError("");
    try {
      await prompt.prompt();
    } catch {
      setError(
        "The install prompt could not open. Use your browser’s menu instead.",
      );
    }
  };
  return { available: prompt !== null, installed, error, install };
}

export function InstallAppPopup({
  installation,
}: {
  installation: ReturnType<typeof useInstallation>;
}) {
  const [open, setOpen] = useState(false);
  const platform = /iPhone|iPod/i.test(navigator.userAgent)
    ? "ios"
    : /Android.*Mobile/i.test(navigator.userAgent)
      ? "android"
      : undefined;
  useEffect(() => {
    const standalone =
      matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!platform || standalone) return;
    try {
      if (localStorage.getItem("weight-logic-install-seen")) return;
      localStorage.setItem("weight-logic-install-seen", "true");
    } catch {
      // Installation help still works when browser storage is unavailable.
    }
    setOpen(true);
  }, [platform]);

  return (
    <Dialog open={open && !installation.installed} onOpenChange={setOpen}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">
          Use Weight Logic as an app
        </DialogTitle>
        <InstallApp installation={installation} platform={platform} />
        <DialogClose asChild>
          <Button>Got it</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

export function InstallApp({
  installation,
  platform,
}: {
  installation: ReturnType<typeof useInstallation>;
  platform?: "ios" | "android";
}) {
  return (
    <section className="panel install-app" aria-labelledby="install-heading">
      <div className="install-heading">
        <img src="/icons/icon-192.png" alt="" width="48" height="48" />
        <h2 id="install-heading">Install Weight Logic</h2>
      </div>
      {installation.installed ? (
        <p role="status">
          Weight Logic is installed. Open it from your home screen or app
          launcher.
        </p>
      ) : (
        <>
          {installation.available && (
            <Button onClick={() => void installation.install()}>
              Install Weight Logic
            </Button>
          )}
          <p>
            Open your journal like an app.{" "}
            {platform !== "android" && (
              <>
                <strong>iPhone or iPad:</strong> Tap Share → Add to Home
                Screen.{" "}
              </>
            )}
            {platform !== "ios" && (
              <>
                <strong>Android:</strong> Tap the browser menu → Install app or
                Add to Home screen.{" "}
              </>
            )}
            Internet connection required.
          </p>
        </>
      )}
      {installation.error && (
        <p role="alert" className="error">
          {installation.error}
        </p>
      )}
    </section>
  );
}
