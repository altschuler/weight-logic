import { describe, expect, it } from "vitest";
import {
  addDays,
  applyCommand,
  baseline,
  budget,
  daysBetween,
  decodeDataset,
  emptyDataset,
  emptyDay,
  goalAt,
  goalPreview,
  inUnits,
  plannedWeight,
  q,
  stats,
  toCanonical,
  todayIn,
  type Dataset,
} from "./index";

const date = "2026-10-11";
const base: Dataset = {
  ...emptyDataset(),
  goals: [
    { activation: "2026-10-01", start: "82", target: "80", deadline: date },
  ],
};
const change = (
  data: Dataset,
  command: Parameters<typeof applyCommand>[1],
  today = date,
) => applyCommand(data, command, today, "2026-10-11T12:00:00Z");
const weight = (
  data: Dataset,
  period: "morning" | "evening",
  value: string | null,
) => change(data, { type: "weight", date, period, value });
const meal = (
  data: Dataset,
  id: string,
  mass: string,
  period: "before" | "after" = "before",
) => change(data, { type: "meal", date, id, mass, period, name: id });

describe("dated plans", () => {
  it("interpolates calendar days, enters maintenance and preserves periods when a later goal replaces itself", () => {
    expect(plannedWeight(base, "2026-09-30")).toBeNull();
    expect(plannedWeight(base, "2026-10-04")!.equals("81.4")).toBe(true);
    expect(plannedWeight(base, "2026-12-01")!.equals(80)).toBe(true);
    let data = change(base, {
      type: "weight",
      date: "2026-10-05",
      period: "evening",
      value: "81.7",
    });
    data = change(
      data,
      { type: "goal", target: "80.5", deadline: date },
      "2026-10-05",
    );
    expect(plannedWeight(data, "2026-10-06")!.equals("81.5")).toBe(true);
    expect(plannedWeight(data, "2026-10-04")!.equals("81.4")).toBe(true);
    data = change(
      data,
      { type: "goal", target: "81", deadline: date },
      "2026-10-05",
    );
    expect(data.goals).toHaveLength(2);
    expect(goalAt(data, "2026-10-05")!.target).toBe("81");
  });
  it("ignores empty records and later measurements but recalculates a corrected activation baseline", () => {
    let data: Dataset = {
      ...base,
      days: [
        { ...emptyDay("2026-09-30"), morning: "83", evening: "82" },
        emptyDay("2026-10-01"),
      ],
    };
    data = weight(data, "morning", "77");
    expect(baseline(data, base.goals[0]).equals(82)).toBe(true);
    data = change(data, {
      type: "weight",
      date: "2026-09-30",
      period: "evening",
      value: "84",
    });
    expect(plannedWeight(data, "2026-10-06")!.equals(82)).toBe(true);
  });
  it("uses signed gain rates and rejects expired replanning while reporting no finite required rate", () => {
    const data: Dataset = {
      ...base,
      goals: [{ ...base.goals[0], target: "84" }],
    };
    expect(plannedWeight(data, "2026-10-06")!.equals(83)).toBe(true);
    expect(
      goalPreview(data, date, "85", "2026-10-21").existingRequiredRate,
    ).toBeNull();
    expect(
      goalPreview(data, date, "85", "2026-10-21").proposedRate!.compare(0),
    ).toBe(-1);
    expect(() =>
      change(weight(data, "morning", "83"), { type: "replan" }),
    ).toThrow("future deadline");
  });
});

describe("mass accounting", () => {
  it("matches the worked example and retains periods through evening and morning removal", () => {
    let data = meal(
      meal(weight(base, "morning", "79.2"), "a", "250"),
      "b",
      "180",
    );
    expect(budget(data, date).remaining!.equals(370)).toBe(true);
    data = meal(weight(data, "evening", "79.7"), "c", "120", "after");
    expect(budget(data, date).gross!.equals(300)).toBe(true);
    expect(budget(data, date).remaining!.equals(180)).toBe(true);
    expect(budget(data, date).total.equals(550)).toBe(true);
    expect(
      budget(weight(data, "evening", "80.2"), date).remaining!.equals(-320),
    ).toBe(true);
    data = weight(data, "evening", null);
    expect(budget(data, date).remaining!.equals(250)).toBe(true);
    expect(data.days[0].meals[2].period).toBe("after");
    data = weight(data, "morning", null);
    expect(budget(data, date).remaining).toBeNull();
    expect(data.days[0].meals).toHaveLength(3);
    expect(() => meal(data, "d", "5")).toThrow("morning");
  });
  it.each(["100", "-100", "101", "-101"])(
    "uses a strict deviation threshold at %s g",
    (deviation) => {
      const morning = q(80).add(q(deviation).div(1000)).toFraction();
      const result = budget(weight(base, "morning", morning), date);
      expect(result.deviation!.equals(deviation)).toBe(true);
      expect(result.significant).toBe(Math.abs(Number(deviation)) > 100);
    },
  );
  it("does not fabricate budgets and does not re-open acknowledged feedback after edits", () => {
    expect(budget(weight(base, "evening", "79"), date).gross).toBeNull();
    expect(
      budget(weight(emptyDataset(), "morning", "79"), date).gross,
    ).toBeNull();
    const data = meal(
      change(weight(base, "morning", "79"), { type: "acknowledge", date }),
      "a",
      "40",
    );
    expect(data.days[0].acknowledged).toBe(true);
    expect(data.goals).toEqual(base.goals);
  });
  it("replans from actual weight and acknowledges without treating food as body weight", () => {
    const today = "2026-10-05";
    let data = change(base, {
      type: "weight",
      date: today,
      period: "morning",
      value: "81.7",
    });
    const before = plannedWeight(data, "2026-10-06")!;
    data = change(data, { type: "replan" }, today);
    expect(
      plannedWeight(data, "2026-10-06")!.equals(q("81.7").sub(q("1.7").div(6))),
    ).toBe(true);
    expect(plannedWeight(data, "2026-10-06")!.equals(before)).toBe(false);
    expect(data.days[0].acknowledged).toBe(true);
  });
});

it("computes endpoint statistics, excludes future measurements and preserves signed gains", () => {
  const data: Dataset = {
    ...base,
    days: [
      { ...emptyDay("2026-10-01"), morning: "83", evening: "82" },
      { ...emptyDay("2026-10-07"), evening: "80.8" },
      { ...emptyDay("2026-10-12"), morning: "72" },
    ],
  };
  const result = stats(data, date);
  expect(result.average!.equals(".2")).toBe(true);
  expect(result.current!.date).toBe("2026-10-07");
  expect(result.lost!.equals("1.2")).toBe(true);
  expect(result.completion).toBe(60);
  expect(
    stats({ ...data, goals: [{ ...base.goals[0], target: "84" }] }, date)
      .completion,
  ).toBeNull();
  expect(stats(emptyDataset(), date).average).toBeNull();
});

it("preserves exact fractional physical quantities across unit changes", () => {
  const kg = toCanonical("176.25", "imperial", "weight");
  expect(inUnits(kg, "imperial", "weight").equals("176.25")).toBe(true);
  expect(
    q(toCanonical("1.25", "imperial", "mass")).equals("35.43690390625"),
  ).toBe(true);
  const data = weight(base, "morning", kg);
  expect(
    budget(
      change(data, { type: "units", units: "imperial" }),
      date,
    ).remaining!.equals(budget(data, date).remaining!),
  ).toBe(true);
});

it("uses whole calendar days through DST and leap days, with timezone-specific today", () => {
  expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  expect(todayIn("Europe/Copenhagen", new Date("2026-10-10T23:30:00Z"))).toBe(
    "2026-10-11",
  );
  expect(todayIn("America/New_York", new Date("2026-10-10T23:30:00Z"))).toBe(
    "2026-10-10",
  );
});

it("validates complete backups, including dates, quantities, duplicates, and relationships", () => {
  const data = meal(weight(base, "morning", "79.125"), "a", "0.25");
  expect(decodeDataset(JSON.parse(JSON.stringify(data)))).toEqual(data);
  expect(() => decodeDataset({ ...data, units: undefined })).toThrow();
  expect(() =>
    decodeDataset({ ...data, days: [...data.days, data.days[0]] }),
  ).toThrow();
  expect(() =>
    decodeDataset({ ...data, days: [{ ...data.days[0], date: "2026-02-30" }] }),
  ).toThrow();
  expect(() =>
    decodeDataset({
      ...data,
      days: [{ ...data.days[0], morning: "Infinity" }],
    }),
  ).toThrow();
  expect(() =>
    decodeDataset({
      ...data,
      days: [
        { ...data.days[0], meals: [{ ...data.days[0].meals[0], mass: "-1" }] },
      ],
    }),
  ).toThrow();
});
