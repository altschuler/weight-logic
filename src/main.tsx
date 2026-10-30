import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { authClient } from "./lib/auth-client";
import { SignIn } from "./components/sign-in";
import { Journal } from "./components/journal";
import { AppUpdate } from "./components/app-update";
import { Button } from "./components/ui/button";
import {
  InstallApp,
  InstallAppPopup,
  useInstallation,
} from "./components/install-app";
import "./styles.css";

function App() {
  const installation = useInstallation();
  const { data, isPending, error, refetch } = authClient.useSession();
  const [resolved, setResolved] = useState(false);
  if (!resolved && !isPending && !error) setResolved(true);
  return (
    <>
      <AppUpdate installed={installation.installed} />
      {!resolved && isPending ? (
        <main className="loading" role="status">
          Opening your journal…
        </main>
      ) : !resolved && error ? (
        <main className="loading">
          <p className="error" role="alert">
            Could not check your session.
          </p>
          <Button onClick={() => void refetch()}>Try again</Button>
        </main>
      ) : data ? (
        <Journal
          key={data.user.id}
          email={data.user.email}
          installation={<InstallApp installation={installation} />}
        />
      ) : (
        <SignIn />
      )}
      {!isPending && <InstallAppPopup installation={installation} />}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
