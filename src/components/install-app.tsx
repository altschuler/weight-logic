import { useEffect, useState } from "react";
import { Button } from "./ui/button";

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

export function InstallApp({
  installation,
}: {
  installation: ReturnType<typeof useInstallation>;
}) {
  return (
    <section className="panel install-app" aria-labelledby="install-heading">
      <div className="install-heading">
        <img src="/icons/icon-192.png" alt="" width="48" height="48" />
        <div>
          <h2 id="install-heading">Weight Logic on your home screen</h2>
          <p className="muted">
            Open your journal like an app. Internet connection required.
          </p>
        </div>
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
          <details open={!installation.available}>
            <summary>How to add it to your home screen</summary>
            <p>
              <strong>iPhone or iPad:</strong> Open this site in Safari, tap
              Share, then Add to Home Screen. Enable Open as Web App if offered,
              then tap Add.
            </p>
            <p>
              <strong>Android:</strong> Open your browser’s menu, then choose
              Install app or Add to Home screen.
            </p>
            <p className="muted">
              If the option is missing, open weightlogic.app directly in Safari
              or Chrome rather than inside another app.
            </p>
          </details>
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
