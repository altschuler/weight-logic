import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { authClient } from "@/lib/auth-client";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "./ui/input-otp";

export function SignIn() {
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<"code" | "link">(() =>
    matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
      ? "code"
      : "link",
  );
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    new URLSearchParams(location.search).has("error")
      ? "This link is invalid or has expired. Request a new one."
      : "",
  );
  const [localLink, setLocalLink] = useState<string | null>(null);
  const [localCode, setLocalCode] = useState<string | null>(null);
  async function send() {
    setBusy(true);
    setError("");
    setLocalLink(null);
    setLocalCode(null);
    try {
      const result =
        method === "code"
          ? await authClient.emailOtp.sendVerificationOtp({
              email,
              type: "sign-in",
            })
          : await authClient.signIn.magicLink({
              email,
              callbackURL: "/",
              errorCallbackURL: "/",
            });
      if (result.error)
        throw new Error(
          result.error.message ?? "Could not send your email. Try again.",
        );
      setSent(true);
      setCode("");
      if (import.meta.env.DEV) {
        const response = await fetch(
          `/api/local-inbox?email=${encodeURIComponent(email)}`,
        );
        const mail = (await response.json()) as {
          url: string | null;
          otp: string | null;
        };
        setLocalLink(mail.url);
        setLocalCode(mail.otp);
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
  }
  return (
    <main className="sign-in">
      <div className="brand">weight logic</div>
      <div className="auth-layout">
        <section className="panel auth-card">
          <h1>
            {sent
              ? method === "code"
                ? "Enter your code"
                : "Check your inbox"
              : "Sign in"}
          </h1>
          {sent && <p>Sent to {email}</p>}
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (method !== "code" || !sent) {
                await send();
                return;
              }
              setBusy(true);
              setError("");
              try {
                const result = await authClient.signIn.emailOtp({
                  email,
                  otp: code.trim(),
                });
                if (result.error)
                  throw new Error(
                    (
                      {
                        INVALID_OTP: "Incorrect code. Try again.",
                        OTP_EXPIRED: "Code expired. Request a new one.",
                        TOO_MANY_ATTEMPTS:
                          "Too many attempts. Request a new code.",
                      } as Record<string, string>
                    )[result.error.code ?? ""] ??
                      result.error.message ??
                      "Could not verify this code. Try again.",
                  );
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
            {!(method === "code" && sent) && (
              <>
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  readOnly={busy}
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </>
            )}
            {method === "code" && sent && (
              <>
                <Label htmlFor="sign-in-code" className="sr-only">
                  Sign-in code
                </Label>
                <InputOTP
                  id="sign-in-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern={REGEXP_ONLY_DIGITS}
                  maxLength={6}
                  required
                  autoFocus
                  disabled={busy}
                  aria-invalid={!!error}
                  aria-describedby={error ? "sign-in-error" : undefined}
                  value={code}
                  onChange={setCode}
                >
                  <InputOTPGroup className="w-full gap-2">
                    {Array.from({ length: 6 }, (_, index) => (
                      <InputOTPSlot
                        key={index}
                        index={index}
                        className="h-11 flex-1 rounded-md border text-lg"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </>
            )}
            {error && (
              <p id="sign-in-error" role="alert" className="error">
                {error}
              </p>
            )}
            <Button
              disabled={
                busy || (method === "code" && sent && code.length !== 6)
              }
              type="submit"
            >
              {busy
                ? "Please wait…"
                : method === "code"
                  ? sent
                    ? "Sign in with code"
                    : "Email me a sign-in code"
                  : sent
                    ? "Send another link"
                    : "Email me a sign-in link"}
            </Button>
            {method === "code" && sent && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void send()}
                >
                  Send a new code
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setSent(false);
                    setCode("");
                    setError("");
                    setLocalCode(null);
                  }}
                >
                  Use another email
                </Button>
              </>
            )}
            {(!sent || method === "link") && (
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setMethod(method === "link" ? "code" : "link");
                  setSent(false);
                  setError("");
                  setLocalLink(null);
                  setLocalCode(null);
                }}
              >
                {method === "link"
                  ? "Use an email code instead"
                  : "Use an email link instead"}
              </Button>
            )}
          </form>
          {localCode && (
            <aside className="local-mail">
              <strong>Local development code</strong>
              <p>
                No email was sent. Enter this single-use code:{" "}
                <code>{localCode}</code>
              </p>
            </aside>
          )}
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
    </main>
  );
}
