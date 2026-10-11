import React from "react";
import { createRoot } from "react-dom/client";
import { authClient } from "./lib/auth-client";
import { SignIn } from "./components/sign-in";
import { Journal } from "./components/journal";
import "./styles.css";

function App() {
  const { data, isPending } = authClient.useSession();
  if (isPending)
    return (
      <main className="loading" role="status">
        Opening your journal…
      </main>
    );
  if (!data) return <SignIn />;
  return <Journal key={data.user.id} email={data.user.email} />;
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
