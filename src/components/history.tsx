import { useState } from "react";
import {
  addDays,
  baseline,
  daysBetween,
  format,
  goalWeight,
  inUnits,
  plannedWeight,
  planRate,
  q,
  stats,
  unitLabel,
  type Dataset,
} from "@weight-logic/domain";
import { Field } from "./forms";
import { Button } from "./ui/button";
import { rateLabel } from "./goal-editor";

export function History({
  data,
  today,
  openDay,
}: {
  data: Dataset;
  today: string;
  openDay: (date: string) => void;
}) {
  const summary = stats(data, today);
  const [projectionDate, setProjectionDate] = useState(
    summary.goal?.deadline ?? today,
  );
  const unit = unitLabel(data.units, "weight");
  return (
    <div className="history-stack">
      <div className="stats-grid">
        <Stat
          label="Current measured weight"
          value={`${format(summary.current?.value ?? null, data.units, "weight")} ${unit}`}
          note={
            summary.current
              ? `Measured ${summary.current.date}`
              : "No measurement yet"
          }
        />
        <Stat
          label="Starting weight"
          value={`${format(summary.start, data.units, "weight")} ${unit}`}
          note="Resolved starting baseline"
        />
        <Stat
          label={
            summary.lost && summary.lost.compare(0) < 0
              ? "Total weight gained"
              : "Total weight lost"
          }
          value={`${format(summary.lost?.abs() ?? null, data.units, "weight")} ${unit}`}
          note="Starting minus current weight"
        />
        <Stat
          label="Average daily change"
          value={rateLabel(summary.average, data)}
          note="Endpoint average; not a trend forecast"
        />
      </div>
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">The longer view</p>
            <h2>Your trajectory</h2>
          </div>
          <span className="status-pill">
            {summary.goal
              ? summary.daysRemaining === 0
                ? "Maintenance"
                : `${summary.daysRemaining} days remaining`
              : "No active goal"}
          </span>
        </div>
        <Trajectory data={data} today={today} />
        <p className="muted">
          Solid lines are your chosen plan, not a prediction. Dots are actual
          measurements; missing weigh-ins stay missing. New goals can create a
          jump.
        </p>
        {summary.completion !== null && (
          <div className="completion">
            <span>Loss-goal completion</span>
            <strong>{Math.round(summary.completion)}%</strong>
            <progress max={100} value={summary.completion} />
          </div>
        )}
        <div className="projection">
          <Field
            label="Inspect planned weight on date"
            type="date"
            value={projectionDate}
            onChange={(event) => {
              if (event.target.value) setProjectionDate(event.target.value);
            }}
          />
          <div>
            <span>Planned evening weight</span>
            <strong data-testid="projection-weight">
              {format(
                plannedWeight(data, projectionDate),
                data.units,
                "weight",
              )}{" "}
              {unit}
            </strong>
          </div>
        </div>
      </section>
      <section className="panel">
        <h2>Recorded days</h2>
        <p className="muted">
          Open a date to review or correct its weigh-ins and meals.
        </p>
        {data.days.length === 0 ? (
          <p className="empty-state">Your first weigh-in will appear here.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Morning ({unit})</th>
                  <th>Evening ({unit})</th>
                  <th>Planned ({unit})</th>
                  <th>Meals</th>
                </tr>
              </thead>
              <tbody>
                {data.days
                  .toSorted((a, b) => b.date.localeCompare(a.date))
                  .map((day) => (
                    <tr key={day.date}>
                      <td>
                        <Button
                          variant="link"
                          onClick={() => openDay(day.date)}
                        >
                          {day.date}
                        </Button>
                      </td>
                      <td>{format(day.morning, data.units, "weight")}</td>
                      <td>{format(day.evening, data.units, "weight")}</td>
                      <td>
                        {format(
                          plannedWeight(data, day.date),
                          data.units,
                          "weight",
                        )}
                      </td>
                      <td>{day.meals.length}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel">
        <h2>Goal history</h2>
        <p className="muted">
          Baselines reflect corrections to the measurements they use.
        </p>
        <div className="goal-history">
          {data.goals.length === 0 ? (
            <p>No goals yet.</p>
          ) : (
            data.goals
              .toSorted((a, b) => b.activation.localeCompare(a.activation))
              .map((goal) => (
                <div key={goal.activation}>
                  <span className="eyebrow">From {goal.activation}</span>
                  <strong>
                    {format(baseline(data, goal), data.units, "weight")} →{" "}
                    {format(goal.target, data.units, "weight")} {unit}
                  </strong>
                  <span>
                    Target date {goal.deadline} ·{" "}
                    {rateLabel(planRate(data, goal), data)}
                  </span>
                </div>
              ))
          )}
        </div>
      </section>
    </div>
  );
}
function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

function Trajectory({ data, today }: { data: Dataset; today: string }) {
  const goals = data.goals.toSorted((a, b) =>
    a.activation.localeCompare(b.activation),
  );
  const dates = [
    ...data.days.map((d) => d.date),
    ...goals.map((g) => g.activation),
    today,
  ].sort();
  const start = dates[0];
  const end = [
    addDays(today, 7),
    ...data.days.map((d) => d.date),
    ...goals.map((g) => addDays(g.deadline, 7)),
  ]
    .sort()
    .at(-1)!;
  const span = Math.max(1, daysBetween(start, end));
  const x = (date: string) => 48 + (daysBetween(start, date) / span) * 692;
  const segments = goals.map((goal, index) => {
    const until = goals[index + 1]?.activation ?? end;
    const dates = [
      goal.activation,
      ...(goal.deadline < until ? [goal.deadline] : []),
      until,
    ];
    return dates.map((date) => ({
      date,
      value: goalWeight(data, goal, date),
    }));
  });
  const observations = data.days.flatMap((day) =>
    (["morning", "evening"] as const).flatMap((period) =>
      day[period] === null
        ? []
        : [{ date: day.date, period, value: q(day[period]) }],
    ),
  );
  const values = [
    ...segments.flatMap((points) =>
      points.map((p) => inUnits(p.value, data.units, "weight").valueOf()),
    ),
    ...observations.map((p) =>
      inUnits(p.value, data.units, "weight").valueOf(),
    ),
  ];
  if (!values.length)
    return (
      <div className="empty-state">
        Your plan and measurements will appear here.
      </div>
    );
  const low = Math.min(...values) - 0.5,
    high = Math.max(...values) + 0.5;
  const y = (value: ReturnType<typeof q>) =>
    200 -
    ((inUnits(value, data.units, "weight").valueOf() - low) / (high - low)) *
      165;
  return (
    <figure className="trajectory">
      <svg
        viewBox="0 0 780 245"
        role="img"
        aria-label="Weight trajectory: planned lines and actual morning and evening measurement dots"
      >
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              x1="48"
              x2="740"
              y1={200 - f * 165}
              y2={200 - f * 165}
              stroke="#e2eae6"
            />
            <text
              x="38"
              y={204 - f * 165}
              textAnchor="end"
              fill="#61746e"
              fontSize="11"
            >
              {(low + f * (high - low)).toFixed(1)}
            </text>
          </g>
        ))}
        <line
          x1={x(today)}
          x2={x(today)}
          y1="20"
          y2="210"
          stroke="#aabbb2"
          strokeDasharray="4 5"
        />
        {segments.map((points, index) => (
          <polyline
            key={index}
            points={points.map((p) => `${x(p.date)},${y(p.value)}`).join(" ")}
            stroke="#17584f"
            strokeWidth="2.5"
            fill="none"
          />
        ))}
        {observations.map((p) => (
          <circle
            key={`${p.date}-${p.period}`}
            cx={x(p.date)}
            cy={y(p.value)}
            r="4"
            fill={p.period === "morning" ? "#91aa66" : "#397b98"}
            stroke="white"
            strokeWidth="1"
          >
            <title>
              {p.date} {p.period}: {format(p.value, data.units, "weight")}
            </title>
          </circle>
        ))}
        <text x="48" y="232" fill="#61746e" fontSize="11">
          {start}
        </text>
        <text x="740" y="232" textAnchor="end" fill="#61746e" fontSize="11">
          {end}
        </text>
      </svg>
      <figcaption>
        <span>
          <i className="legend-plan" /> Planned
        </span>
        <span>
          <i className="legend-morning" /> Morning
        </span>
        <span>
          <i className="legend-evening" /> Evening
        </span>
        <span>Dashed marker: today</span>
      </figcaption>
    </figure>
  );
}
