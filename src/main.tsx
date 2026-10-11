import React from "react";
import { createRoot } from "react-dom/client";
import { authClient } from "./lib/auth-client";
import { SignIn } from "./components/sign-in";
import { Journal } from "./components/journal";
import { AppUpdate } from "./components/app-update";
import {
  InstallApp,
  InstallAppPopup,
  useInstallation,
} from "./components/install-app";
import "./styles.css";

function App() {
  const installation = useInstallation();
  const { data, isPending } = authClient.useSession();
  return (
    <>
      <AppUpdate installed={installation.installed} />
      {isPending ? (
        <main className="loading" role="status">
          Opening your journal…
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
