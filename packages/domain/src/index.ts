import { Schema } from "effect";
import Fraction from "fraction.js";

export const q = (value: string | number | Fraction) => new Fraction(value);
const validQuantity = (value: string, positive: boolean) => {
  if (!/^(?:\d+(?:\.\d+)?|\d+\/[1-9]\d*)$/.test(value)) return false;
  try {
    const n = q(value);
    return (
      Number.isFinite(n.valueOf()) &&
      (positive ? n.compare(0) > 0 : n.compare(0) >= 0)
    );
  } catch {
    return false;
  }
};
export const Weight = Schema.String.check(
  Schema.makeFilter((s) => validQuantity(s, true), {
    message: "Enter a positive weight.",
  }),
);
export const Mass = Schema.String.check(
  Schema.makeFilter((s) => validQuantity(s, false), {
    message: "Enter a non-negative meal mass.",
  }),
);
export const DateOnly = Schema.String.check(
  Schema.makeFilter(
    (s) =>
      /^\d{4}-\d{2}-\d{2}$/.test(s) &&
      Number.isFinite(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
    { message: "Enter a valid calendar date." },
  ),
);
export const Units = Schema.Literals(["metric", "imperial"]);
export type Units = typeof Units.Type;
const Period = Schema.Literals(["before", "after"]);
const Meal = Schema.Struct({
  id: Schema.String,
  mass: Mass,
  name: Schema.String,
  period: Period,
  recordedAt: Schema.String.check(
    Schema.makeFilter(
      (s) => /^\d{4}-\d{2}-\d{2}T/.test(s) && Number.isFinite(Date.parse(s)),
    ),
  ),
});
const Day = Schema.Struct({
  date: DateOnly,
  morning: Schema.NullOr(Weight),
  evening: Schema.NullOr(Weight),
  acknowledged: Schema.Boolean,
  meals: Schema.Array(Meal),
});
const Goal = Schema.Struct({
  activation: DateOnly,
  start: Weight,
  target: Weight,
  deadline: DateOnly,
}).check(
  Schema.makeFilter((g) => g.deadline > g.activation, {
    message: "The target date must be after the activation date.",
  }),
);
export const Dataset = Schema.Struct({
  version: Schema.Literal(1),
  units: Units,
  days: Schema.Array(Day),
  goals: Schema.Array(Goal),
}).check(
  Schema.makeFilter(
    (data) => {
      const mealIds = data.days.flatMap((d) => d.meals.map((m) => m.id));
      return (
        new Set(data.days.map((d) => d.date)).size === data.days.length &&
        new Set(data.goals.map((g) => g.activation)).size ===
          data.goals.length &&
        new Set(mealIds).size === mealIds.length
      );
    },
    { message: "The backup contains duplicate dates or meal IDs." },
  ),
);
export type Dataset = typeof Dataset.Type;
export type Day = typeof Day.Type;
export type Meal = typeof Meal.Type;
export type Goal = typeof Goal.Type;
export const emptyDataset = (): Dataset => ({
  version: 1,
  units: "metric",
  days: [],
  goals: [],
});
export const emptyDay = (date: string): Day => ({
  date,
  morning: null,
  evening: null,
  acknowledged: false,
  meals: [],
});
export const decodeDataset = Schema.decodeUnknownSync(Dataset, {
  onExcessProperty: "error",
});

export const Command = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("weight"),
    date: DateOnly,
    period: Schema.Literals(["morning", "evening"]),
    value: Schema.NullOr(Weight),
  }),
  Schema.Struct({
    type: Schema.Literal("meal"),
    date: DateOnly,
    id: Schema.String,
    mass: Mass,
    name: Schema.String,
    period: Period,
  }),
  Schema.Struct({
    type: Schema.Literal("deleteMeal"),
    date: DateOnly,
    id: Schema.String,
  }),
  Schema.Struct({ type: Schema.Literal("acknowledge"), date: DateOnly }),
  Schema.Struct({
    type: Schema.Literal("goal"),
    target: Weight,
    deadline: DateOnly,
    start: Schema.optional(Weight),
  }),
  Schema.Struct({ type: Schema.Literal("replan") }),
  Schema.Struct({ type: Schema.Literal("units"), units: Units }),
  Schema.Struct({
    type: Schema.Literal("restore"),
    data: Dataset,
    confirmed: Schema.Literal(true),
  }),
  Schema.Struct({
    type: Schema.Literal("clear"),
    confirmed: Schema.Literal(true),
  }),
]);
export type Command = typeof Command.Type;
export const decodeCommand = Schema.decodeUnknownSync(Command, {
  onExcessProperty: "error",
});

export const daysBetween = (from: string, to: string) =>
  (Date.parse(to) - Date.parse(from)) / 86_400_000;
export function addDays(date: string, days: number) {
  return new Date(Date.parse(date) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}
export function todayIn(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((type) => parts.find((p) => p.type === type)!.value)
    .join("-");
}
export const localToday = () =>
  todayIn(Intl.DateTimeFormat().resolvedOptions().timeZone);
export const representative = (day: Day) => day.evening ?? day.morning;
export const measuredDays = (data: Dataset, through: string) =>
  data.days
    .filter((d) => d.date <= through && representative(d) !== null)
    .toSorted((a, b) => a.date.localeCompare(b.date));
export const latestMeasurement = (data: Dataset, through: string) => {
  const day = measuredDays(data, through).at(-1);
  return day ? { date: day.date, value: representative(day)! } : null;
};
export const goalAt = (data: Dataset, date: string) =>
  data.goals
    .filter((g) => g.activation <= date)
    .toSorted((a, b) => a.activation.localeCompare(b.activation))
    .at(-1) ?? null;
export const baseline = (data: Dataset, goal: Goal) =>
  q(latestMeasurement(data, goal.activation)?.value ?? goal.start);
export const planRate = (data: Dataset, goal: Goal) =>
  baseline(data, goal)
    .sub(goal.target)
    .div(daysBetween(goal.activation, goal.deadline));
export function goalWeight(data: Dataset, goal: Goal, date: string) {
  return date >= goal.deadline
    ? q(goal.target)
    : baseline(data, goal).sub(
        planRate(data, goal).mul(daysBetween(goal.activation, date)),
      );
}
export function plannedWeight(data: Dataset, date: string) {
  const goal = goalAt(data, date);
  return goal ? goalWeight(data, goal, date) : null;
}
export function budget(data: Dataset, date: string) {
  const day = data.days.find((d) => d.date === date) ?? emptyDay(date);
  const planned = plannedWeight(data, date);
  const before = day.meals
    .filter((m) => m.period === "before")
    .reduce((sum, m) => sum.add(m.mass), q(0));
  const after = day.meals
    .filter((m) => m.period === "after")
    .reduce((sum, m) => sum.add(m.mass), q(0));
  const total = before.add(after);
  const applicable = day.evening === null ? total : after;
  const gross =
    day.morning !== null && planned !== null
      ? planned.sub(day.evening ?? day.morning).mul(1000)
      : null;
  const remaining = gross?.sub(applicable) ?? null;
  return {
    planned,
    before,
    after,
    total,
    applicable,
    gross,
    remaining,
    deviation: remaining?.neg() ?? null,
    significant: remaining !== null && remaining.abs().compare(100) > 0,
  };
}
export function stats(data: Dataset, today: string) {
  const measured = measuredDays(data, today);
  const first = measured.at(0);
  const current = latestMeasurement(data, today);
  const earliestGoal = data.goals
    .filter((g) => g.activation <= today)
    .toSorted((a, b) => a.activation.localeCompare(b.activation))[0];
  const start = earliestGoal
    ? baseline(data, earliestGoal)
    : first
      ? q(first.morning ?? first.evening!)
      : null;
  const lost = start && current ? start.sub(current.value) : null;
  const average =
    measured.length >= 2
      ? q(representative(first!)!)
          .sub(current!.value)
          .div(daysBetween(first!.date, current!.date))
      : null;
  const goal = goalAt(data, today);
  const denominator = start && goal ? start.sub(goal.target) : null;
  const completion =
    lost && denominator && denominator.compare(0) > 0
      ? Math.max(0, Math.min(100, lost.div(denominator).mul(100).valueOf()))
      : null;
  return {
    current,
    start,
    lost,
    average,
    completion,
    goal,
    daysRemaining: goal ? Math.max(0, daysBetween(today, goal.deadline)) : null,
  };
}
export function goalPreview(
  data: Dataset,
  today: string,
  target: string,
  deadline: string,
  fallback?: string,
) {
  const current = latestMeasurement(data, today);
  const existing = goalAt(data, today);
  const reference = current
    ? q(current.value)
    : existing
      ? baseline(data, existing)
      : fallback
        ? q(fallback)
        : null;
  const remaining = daysBetween(today, deadline);
  const oldRemaining = existing ? daysBetween(today, existing.deadline) : 0;
  return {
    current,
    reference,
    remaining,
    proposedRate:
      reference && remaining > 0 ? reference.sub(target).div(remaining) : null,
    existingRequiredRate:
      reference && existing && oldRemaining > 0
        ? reference.sub(existing.target).div(oldRemaining)
        : null,
    originalRate: existing ? planRate(data, existing) : null,
  };
}

// Synchronous transition: the DO persists the result within one SQLite transaction.
export function applyCommand(
  data: Dataset,
  command: Command,
  today: string,
  recordedAt = new Date().toISOString(),
): Dataset {
  if (command.type === "restore") return command.data;
  if (command.type === "clear") return emptyDataset();
  if (command.type === "units") return { ...data, units: command.units };
  if (command.type === "goal" || command.type === "replan") {
    const existing = goalAt(data, today);
    const current = latestMeasurement(data, today);
    if (
      command.type === "replan" &&
      (!existing || existing.deadline <= today || current?.date !== today)
    )
      throw new Error(
        "Replanning needs a measurement today and a future deadline.",
      );
    const target = command.type === "goal" ? command.target : existing!.target;
    const deadline =
      command.type === "goal" ? command.deadline : existing!.deadline;
    const reference =
      current?.value ??
      (existing
        ? baseline(data, existing).toFraction()
        : command.type === "goal"
          ? command.start
          : undefined);
    if (!reference) throw new Error("Enter a starting weight.");
    if (deadline <= today) throw new Error("Choose a target date after today.");
    const goal: Goal = {
      activation: today,
      start: reference,
      target,
      deadline,
    };
    const next = {
      ...data,
      goals: [...data.goals.filter((g) => g.activation !== today), goal],
    };
    return command.type === "replan"
      ? applyCommand(next, { type: "acknowledge", date: today }, today)
      : next;
  }
  const day =
    data.days.find((d) => d.date === command.date) ?? emptyDay(command.date);
  let changed = day;
  if (command.type === "weight")
    changed = { ...day, [command.period]: command.value };
  if (command.type === "acknowledge") changed = { ...day, acknowledged: true };
  if (command.type === "deleteMeal")
    changed = { ...day, meals: day.meals.filter((m) => m.id !== command.id) };
  if (command.type === "meal") {
    const existing = day.meals.find((m) => m.id === command.id);
    if (!existing && day.morning === null)
      throw new Error("Record a morning weight before adding meals.");
    if (
      data.days.some(
        (d) => d.date !== day.date && d.meals.some((m) => m.id === command.id),
      )
    )
      throw new Error("Meal ID already exists on another date.");
    changed = {
      ...day,
      meals: [
        ...day.meals.filter((m) => m.id !== command.id),
        {
          id: command.id,
          mass: command.mass,
          name: command.name,
          period: command.period,
          recordedAt: existing?.recordedAt ?? recordedAt,
        },
      ],
    };
  }
  return {
    ...data,
    days: [...data.days.filter((d) => d.date !== day.date), changed],
  };
}

export function toCanonical(
  value: string,
  units: Units,
  kind: "weight" | "mass",
) {
  if (!/^\d+(?:\.\d+)?$/.test(value))
    throw new Error("Enter a valid decimal amount.");
  const result = q(value).mul(
    units === "metric" ? 1 : kind === "weight" ? "0.45359237" : "28.349523125",
  );
  if (kind === "weight" && result.compare(0) <= 0)
    throw new Error("Weight must be greater than zero.");
  return result.toFraction();
}
export const inUnits = (
  value: string | Fraction,
  units: Units,
  kind: "weight" | "mass",
) =>
  q(value).div(
    units === "metric" ? 1 : kind === "weight" ? "0.45359237" : "28.349523125",
  );
export const unitLabel = (units: Units, kind: "weight" | "mass") =>
  units === "metric"
    ? kind === "weight"
      ? "kg"
      : "g"
    : kind === "weight"
      ? "lb"
      : "oz";
export function format(
  value: string | Fraction | null,
  units: Units,
  kind: "weight" | "mass",
  digits = kind === "weight" ? 2 : 1,
) {
  return value === null
    ? "—"
    : inUnits(value, units, kind)
        .valueOf()
        .toLocaleString("en", { maximumFractionDigits: digits });
}
