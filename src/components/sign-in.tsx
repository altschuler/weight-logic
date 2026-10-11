import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { authClient } from "@/lib/auth-client";

export function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    new URLSearchParams(location.search).has("error")
      ? "This link is invalid or has expired. Request a new one."
      : "",
  );
  const [localLink, setLocalLink] = useState<string | null>(null);
  return (
    <main className="sign-in">
      <div className="brand">weight logic</div>
      <div className="auth-layout">
        <section className="panel auth-card">
          <h1>{sent ? "Check your inbox" : "Sign in"}</h1>
          <p>
            {sent
              ? `We sent a sign-in link to ${email}. It works once and expires in 10 minutes. Check your spam folder too.`
              : "Enter your email to sign in or create an account."}
          </p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              setLocalLink(null);
              try {
                const result = await authClient.signIn.magicLink({
                  email,
                  callbackURL: "/",
                  errorCallbackURL: "/",
                });
                if (result.error)
                  throw new Error(
                    result.error.message ??
                      "Could not send your link. Try again.",
                  );
                setSent(true);
                if (import.meta.env.DEV) {
                  const response = await fetch(
                    `/api/local-inbox?email=${encodeURIComponent(email)}`,
                  );
                  const mail = (await response.json()) as {
                    url: string | null;
                  };
                  setLocalLink(mail.url);
                }
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Could not connect. Try again.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <Button disabled={busy} type="submit">
              {busy
                ? "Sending…"
                : sent
                  ? "Send another link"
                  : "Email me a sign-in link"}
            </Button>
          </form>
          {localLink && (
            <aside className="local-mail">
              <strong>Local development inbox</strong>
              <p>
                No email was sent. This uses a real, single-use sign-in link.
              </p>
              <a href={localLink}>Open local sign-in link</a>
            </aside>
          )}
        </section>
      </div>
      <p className="model-note">
        A tracking tool, not medical advice. Food mass does not measure
        calories, nutrition, or body-fat change.
      </p>
    </main>
  );
}
