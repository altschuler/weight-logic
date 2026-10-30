import { auth, localInbox, localOTP } from "./auth";
import type { Env } from "./env";
import { todayIn } from "@weight-logic/domain";
export { Tracker } from "./tracker";

const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
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
        return await auth(env).handler(request);
      if (url.pathname !== "/api/tracker")
        return json({ error: "Not found" }, 404);
      const session = await auth(env).api.getSession({
        headers: request.headers,
      });
      if (!session)
        return json({ error: "Sign in to access your journal." }, 401);
      const tracker = env.TRACKERS.getByName(session.user.id);
      if (request.method === "GET") return json(await tracker.read());
      if (request.method !== "POST")
        return json({ error: "Method not allowed" }, 405);
      if (request.headers.get("Origin") !== env.APP_URL)
        return json({ error: "Request origin is not allowed." }, 403);
      let today: string;
      try {
        today = todayIn(request.headers.get("X-Timezone") ?? "");
      } catch {
        return json({ error: "A valid timezone is required." }, 400);
      }
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let size = 0;
      try {
        if (request.body) {
          for await (const chunk of request.body) {
            size += chunk.byteLength;
            if (size > 1_600_000)
              return json(
                {
                  error:
                    "The backup is too large (maximum 1.5 MB of tracker data).",
                },
                413,
              );
            chunks.push(chunk);
          }
        }
      } catch {
        return json({ error: "Could not read request." }, 400);
      }
      let input: unknown;
      try {
        input = JSON.parse(await new Blob(chunks).text());
      } catch {
        return json({ error: "Invalid JSON." }, 400);
      }
      const result = await tracker.execute(input, today);
      return result.ok ? json(result.data) : json({ error: result.error }, 400);
    } catch {
      console.error("Unexpected failure handling application request.");
      return json(
        { error: "The service is temporarily unavailable. Please try again." },
        500,
      );
    }
  },
};
