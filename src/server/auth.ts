import { betterAuth } from "better-auth";
import { emailOTP, magicLink } from "better-auth/plugins";
import { Effect } from "effect";
import type { Env } from "./env";

// Local-only inbox. Never contains production mail; no email or token logging.
const inbox = new Map<
  string,
  { url?: string; otp?: string; expires: number }
>();
export const localInbox = (email: string) => {
  const mail = inbox.get(email.toLowerCase());
  return mail && mail.expires > Date.now() ? (mail.url ?? null) : null;
};
export const localOTP = (email: string) => {
  const mail = inbox.get(email.toLowerCase());
  return mail && mail.expires > Date.now() ? (mail.otp ?? null) : null;
};

function sendSignInEmail(
  env: Env,
  email: string,
  credential: { url: string } | { otp: string },
) {
  return Effect.runPromise(
    Effect.tryPromise(async () => {
      if (env.LOCAL_EMAIL === "true") {
        for (const [key, mail] of inbox)
          if (mail.expires < Date.now()) inbox.delete(key);
        inbox.set(email.toLowerCase(), {
          ...credential,
          expires: Date.now() + 600_000,
        });
        return;
      }
      const isCode = "otp" in credential;
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Weight Logic <signin@weightlogic.app>",
          to: [email],
          subject: isCode
            ? "Your Weight Logic sign-in code"
            : "Your Weight Logic sign-in link",
          text: isCode
            ? `Your Weight Logic sign-in code is:\n\n${credential.otp}\n\nReturn to the app or browser where you requested it and enter this code. It expires in 10 minutes and can be used once. If you did not request it, ignore this email.`
            : `Sign in to Weight Logic:\n\n${credential.url}\n\nThis link expires in 10 minutes and can be used once. If you did not request it, you can ignore this email.`,
        }),
      });
      if (!response.ok)
        throw new Error("Email delivery is unavailable. Please try again.");
    }),
  );
}

export function auth(env: Env) {
  return betterAuth({
    database: env.DB,
    baseURL: env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_URL],
    advanced: {
      // Cloudflare supplies this header; do not trust client forwarding headers.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
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
        sendMagicLink: ({ email, url }) => sendSignInEmail(env, email, { url }),
      }),
      emailOTP({
        storeOTP: "hashed",
        otpLength: 6,
        expiresIn: 600,
        allowedAttempts: 3,
        sendVerificationOTP: async ({ email, otp, type }) => {
          if (type !== "sign-in")
            throw new Error("Only sign-in codes are supported.");
          await sendSignInEmail(env, email, { otp });
        },
      }),
    ],
  });
}
