import { isDeepStrictEqual } from "node:util";
import {
  addDays,
  decodeDataset,
  localToday,
  stats,
  type Dataset,
} from "../packages/domain/src/index.ts";

const origin = "http://localhost:5173";
const accounts = {
  steady: "demo-steady@example.test",
  plateau: "demo-plateau@example.test",
} as const;
const scenario = process.argv[2];
if (
  process.argv.length !== 3 ||
  (scenario !== "steady" && scenario !== "plateau")
) {
  throw new Error("Usage: pnpm seed steady | pnpm seed plateau (Node 24)");
}
const email = accounts[scenario];
const today = localToday();
const start = addDays(today, -55);
const noise = [0, 0.12, -0.08, 0.18, -0.15, 0.04, -0.03];
const menus = [
  [
    ["Greek yogurt, oats and berries", 320],
    ["Eggs on sourdough", 280],
    ["Porridge and banana", 350],
  ],
  [
    ["Chicken and rice bowl", 480],
    ["Lentil soup and bread", 520],
    ["Rye sandwich and carrot salad", 390],
  ],
  [
    ["Salmon, potatoes and greens", 460],
    ["Tofu vegetable stir-fry", 440],
    ["Pasta with tomato and lentils", 510],
  ],
  [
    ["Apple and almonds", 180],
    ["Yogurt and berries", 190],
    ["Pear", 160],
  ],
] as const;
let data: Dataset = decodeDataset({
  version: 1,
  units: "metric",
  days: Array.from({ length: 56 }, (_, i) => {
    const date = addDays(start, i);
    const weight =
      scenario === "steady" ? 86 - i * 0.065 : 92 - Math.min(i, 24) * 0.065;
    const missing = i > 0 && i < 55 && i % 13 === 7;
    const morning = missing
      ? null
      : (weight + noise[i % noise.length]!).toFixed(2);
    const evening =
      missing || i === 55 || i % 6 === 3
        ? null
        : (weight + noise[i % noise.length]! + 0.22 + (i % 3) * 0.04).toFixed(
            2,
          );
    return {
      date,
      morning,
      evening,
      acknowledged: i < 52,
      meals: missing
        ? []
        : Array.from({ length: i === 55 ? 2 : 4 }, (_, j) => {
            const [name, mass] = menus[j]![i % 3]!;
            return {
              id: `${scenario}-${date}-${j}`,
              name,
              mass: String(mass + ((i % 5) - 2) * 10),
              period: j === 3 && evening !== null ? "after" : "before",
              recordedAt: new Date(
                `${date}T${["08", "12", "17", "20"][j]}:00:00`,
              ).toISOString(),
            };
          }),
    };
  }),
  goals: [
    {
      activation: start,
      start: scenario === "steady" ? "86.22" : "92.22",
      target: scenario === "steady" ? "80" : "86",
      deadline: addDays(today, 42),
    },
  ],
});
if (scenario === "plateau") {
  const replan = data.days[49]!;
  data = decodeDataset({
    ...data,
    goals: [
      ...data.goals,
      {
        activation: replan.date,
        start: replan.evening!,
        target: "86",
        deadline: addDays(today, 42),
      },
    ],
  });
}

// Never follow redirects: even auth links must stay on the fixed local origin.
async function request(path: string, init: RequestInit = {}) {
  const url = new URL(path, origin);
  if (url.origin !== origin) throw new Error("Refusing a non-local URL.");
  const response = await fetch(url, { ...init, redirect: "manual" });
  if (!response.ok && !(response.status >= 300 && response.status < 400)) {
    throw new Error(
      `${url.pathname}: HTTP ${response.status}. Is pnpm dev running?`,
    );
  }
  return response;
}
async function loginLink() {
  await request("/api/auth/sign-in/magic-link", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ email, callbackURL: "/" }),
  });
  const { url } = (await (
    await request(`/api/local-inbox?email=${encodeURIComponent(email)}`)
  ).json()) as { url?: unknown };
  if (typeof url !== "string" || new URL(url).origin !== origin) {
    throw new Error(
      "No local magic link. This script requires the local development inbox.",
    );
  }
  return url;
}

// Check the development-only endpoint before requesting any email.
await (await request("/api/local-inbox")).json();
const verification = await request(await loginLink());
const cookie = verification.headers
  .getSetCookie()
  .map((value) => value.split(";")[0])
  .join("; ");
if (!cookie)
  throw new Error("Magic-link verification did not create a session.");
const headers = { Cookie: cookie, Origin: origin };
const session = (await (
  await request("/api/auth/get-session", { headers })
).json()) as { user?: { email?: string } } | null;
if (session?.user?.email !== email)
  throw new Error("Refusing to overwrite an unexpected account.");
await request("/api/tracker", {
  method: "POST",
  headers: {
    ...headers,
    "Content-Type": "application/json",
    "X-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
  body: JSON.stringify({ type: "restore", data, confirmed: true }),
});
const saved = decodeDataset(
  await (await request("/api/tracker", { headers })).json(),
);
if (!isDeepStrictEqual(saved, data))
  throw new Error("Saved journal differs from the seed.");
const progress = stats(saved, today);
console.log(
  `Restored ${scenario} to ${email}: ${saved.days.length} days (${start} through ${today}), ${saved.days.filter((d) => d.morning !== null).length} morning weigh-ins, ${saved.days.flatMap((d) => d.meals).length} meals, ${saved.goals.length} goal periods.`,
);
console.log(
  `Lost ${progress.lost?.valueOf().toFixed(2)} kg; progress ${progress.completion?.toFixed(1)}%. Saved data validated and matched exactly.`,
);
console.log(
  `Open this fresh single-use login link (expires in 10 minutes):\n${await loginLink()}`,
);
