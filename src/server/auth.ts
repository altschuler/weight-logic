import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { Effect } from "effect";
import type { Env } from "./env";

// Local-only inbox. Never contains production mail; no email or token logging.
const inbox = new Map<string, { url: string; expires: number }>();
export const localInbox = (email: string) => {
  const mail = inbox.get(email.toLowerCase());
  return mail && mail.expires > Date.now() ? mail.url : null;
};

export function auth(env: Env) {
  return betterAuth({
    database: env.DB,
    baseURL: env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_URL],
    rateLimit: {
      enabled: env.LOCAL_EMAIL !== "true",
      storage: "database",
      window: 60,
      max: 60,
    },
    plugins: [
      magicLink({
        storeToken: "hashed",
        expiresIn: 600,
        sendMagicLink: ({ email, url }) =>
          Effect.runPromise(
            Effect.tryPromise(async () => {
              if (env.LOCAL_EMAIL === "true") {
                for (const [key, mail] of inbox)
                  if (mail.expires < Date.now()) inbox.delete(key);
                inbox.set(email.toLowerCase(), {
                  url,
                  expires: Date.now() + 600_000,
                });
                return;
              }
              const response = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${env.RESEND_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: "Weight Logic <signin@weightlogic.app>",
                  to: [email],
                  subject: "Your Weight Logic sign-in link",
                  text: `Sign in to Weight Logic:\n\n${url}\n\nThis link expires in 10 minutes and can be used once. If you did not request it, you can ignore this email.`,
                }),
              });
              if (!response.ok)
                throw new Error(
                  "Email delivery is unavailable. Please try again.",
                );
            }),
          ),
      }),
    ],
  });
}
