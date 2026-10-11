import { auth, localInbox, localOTP } from "./auth";
import type { Env } from "./env";
import { Data, Effect } from "effect";
import { todayIn } from "@weight-logic/domain";
export { Tracker } from "./tracker";

class HttpError extends Data.TaggedError("HttpError")<{
  status: number;
  message: string;
}> {}
const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return Effect.runPromise(
      Effect.gen(function* () {
        const url = new URL(request.url);
        if (
          url.pathname === "/api/local-inbox" &&
          env.LOCAL_EMAIL === "true" &&
          request.method === "GET"
        ) {
          const email = url.searchParams.get("email") ?? "";
          return json({ url: localInbox(email), otp: localOTP(email) });
        }
        if (url.pathname.startsWith("/api/auth/"))
          return yield* Effect.tryPromise(() => auth(env).handler(request));
        if (url.pathname !== "/api/tracker")
          return json({ error: "Not found" }, 404);
        const session = yield* Effect.tryPromise(() =>
          auth(env).api.getSession({ headers: request.headers }),
        );
        if (!session)
          return yield* Effect.fail(
            new HttpError({
              status: 401,
              message: "Sign in to access your journal.",
            }),
          );
        const tracker = env.TRACKERS.getByName(session.user.id);
        if (request.method === "GET")
          return json(yield* Effect.tryPromise(() => tracker.read()));
        if (request.method !== "POST")
          return json({ error: "Method not allowed" }, 405);
        if (request.headers.get("Origin") !== env.APP_URL)
          return yield* Effect.fail(
            new HttpError({
              status: 403,
              message: "Request origin is not allowed.",
            }),
          );
        const today = yield* Effect.try({
          try: () => todayIn(request.headers.get("X-Timezone") ?? ""),
          catch: () =>
            new HttpError({
              status: 400,
              message: "A valid timezone is required.",
            }),
        });
        const body = yield* Effect.tryPromise({
          try: () => request.text(),
          catch: () =>
            new HttpError({ status: 400, message: "Could not read request." }),
        });
        if (new TextEncoder().encode(body).length > 1_600_000)
          return json(
            {
              error:
                "The backup is too large (maximum 1.5 MB of tracker data).",
            },
            413,
          );
        const input = yield* Effect.try({
          try: () => JSON.parse(body) as unknown,
          catch: () => new HttpError({ status: 400, message: "Invalid JSON." }),
        });
        const result = yield* Effect.tryPromise(
          async () => await tracker.execute(input, today),
        );
        return result.ok
          ? json(result.data)
          : json({ error: result.error }, 400);
      }).pipe(
        Effect.catchTag("HttpError", (error) =>
          Effect.succeed(json({ error: error.message }, error.status)),
        ),
        Effect.catch(() =>
          Effect.succeed(
            json(
              {
                error:
                  "The service is temporarily unavailable. Please try again.",
              },
              500,
            ),
          ),
        ),
      ),
    );
  },
};
