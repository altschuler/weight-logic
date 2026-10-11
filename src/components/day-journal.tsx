import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import {
  budget,
  emptyDay,
  format,
  goalAt,
  inUnits,
  toCanonical,
  unitLabel,
  type Dataset,
  type Meal,
} from "@weight-logic/domain";
import type { Mutate } from "@/lib/journal";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { NativeSelect } from "./ui/native-select";
import { ActionForm, Field, Modal } from "./forms";
import { GoalEditor } from "./goal-editor";

export function DayJournal({
  data,
  date,
  today,
  mutate,
}: {
  data: Dataset;
  date: string;
  today: string;
  mutate: Mutate;
}) {
  const day = data.days.find((d) => d.date === date) ?? emptyDay(date);
  const totals = budget(data, date);
  const goal = goalAt(data, today);
  const [weightEditor, setWeightEditor] = useState<
    "morning" | "evening" | null
  >(null);
  const [mealEditor, setMealEditor] = useState<Meal | "new" | null>(null);
  const [replan, setReplan] = useState(false);
  const wu = unitLabel(data.units, "weight");
  const mu = unitLabel(data.units, "mass");
  const canReplan =
    date === today &&
    (day.morning !== null || day.evening !== null) &&
    goal !== null &&
    goal.deadline > today;
  const weightSection = (period: "morning" | "evening") => (
    <section className="journal-section">
      <h2 className="capitalize">{period}</h2>
      <div className="weigh-row">
        <div>
          {day[period] === null ? (
            <span>No weight recorded</span>
          ) : (
            <>
              <span>Weight</span>
              <strong>
                {format(day[period], data.units, "weight")} <small>{wu}</small>
              </strong>
            </>
          )}
        </div>
        <Button
          variant={day[period] === null ? "outline" : "ghost"}
          aria-label={`${day[period] === null ? "Add" : "Edit"} ${period} weight`}
          onClick={() => setWeightEditor(period)}
        >
          {day[period] === null ? <Plus /> : <Pencil />}
          {day[period] === null ? "Add weight" : "Edit"}
        </Button>
      </div>
    </section>
  );
  return (
    <>
      {weightSection("morning")}
      <section className="journal-section meals">
        <h2>Meals</h2>
        <div className="meal-content">
          {day.meals.length === 0 ? (
            <div className="empty-state">
              <h3>No meals recorded</h3>
              <p>
                {day.morning === null
                  ? "Add a morning weigh-in first, then record your meals here."
                  : "Add a meal to record its mass."}
              </p>
            </div>
          ) : (
            <div className="meal-list">
              {day.meals.map((meal) => (
                <div className="meal-row" key={meal.id}>
                  <div className="meal-name">
                    <strong>{meal.name || "Unnamed meal"}</strong>
                    <span>
                      {meal.period === "before"
                        ? "Before evening"
                        : "After evening"}
                    </span>
                  </div>
                  <strong>
                    {format(meal.mass, data.units, "mass")} {mu}
                  </strong>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${meal.name || "unnamed meal"}`}
                    onClick={() => setMealEditor(meal)}
                  >
                    <Pencil />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="meal-actions">
            <Button
              onClick={() => setMealEditor("new")}
              disabled={day.morning === null}
            >
              <Plus /> Add meal
            </Button>
            <details className="meal-summary">
              <summary>
                Total{" "}
                <strong data-testid="meal-total">
                  {format(totals.total, data.units, "mass")} {mu}
                </strong>
              </summary>
              <div className="meal-totals">
                <div>
                  <span>Before evening</span>
                  <strong>
                    {format(totals.before, data.units, "mass")} {mu}
                  </strong>
                </div>
                <div>
                  <span>After evening</span>
                  <strong>
                    {format(totals.after, data.units, "mass")} {mu}
                  </strong>
                </div>
              </div>
            </details>
          </div>
        </div>
      </section>
      {weightSection("evening")}
      <section className="budget-panel" aria-label="Food-mass budget">
        <div className="budget-summary">
          <div>
            <p>Planned evening</p>
            <p className="budget-number">
              {format(totals.planned, data.units, "weight")} <span>{wu}</span>
            </p>
          </div>
          <div>
            <p>Remaining budget</p>
            <p className="budget-number" data-testid="remaining-budget">
              {format(totals.remaining, data.units, "mass")}
              <span>{totals.remaining !== null ? mu : ""}</span>
            </p>
          </div>
        </div>
        <details className="budget-details">
          <summary>Calculation</summary>
          <div className="budget-equation">
            <div>
              <span>Gross budget</span>
              <strong>
                {format(totals.gross, data.units, "mass")} {mu}
              </strong>
            </div>
            <span aria-hidden="true">−</span>
            <div>
              <span>Applicable meals</span>
              <strong>
                {format(totals.applicable, data.units, "mass")} {mu}
              </strong>
            </div>
          </div>
          <p className="budget-footnote">
            {day.evening !== null
              ? "Earlier meals stay in your history. Only after-evening meals reduce this budget."
              : "All meals for this date count until an evening weight is recorded."}
          </p>
        </details>
        {(totals.remaining === null || totals.remaining.compare(0) < 0) && (
          <p className="budget-caption">
            {totals.remaining === null
              ? !totals.planned
                ? "Set a goal to calculate a planned weight."
                : "Record a morning weight to see the budget."
              : "Above plan—not a reason to restrict food or fluids."}
          </p>
        )}
      </section>
      {totals.significant && !day.acknowledged && (
        <section className="feedback" aria-label="Plan reflection">
          <div>
            <p>
              {format(totals.deviation!.abs(), data.units, "mass")} {mu}{" "}
              {totals.deviation!.compare(0) > 0 ? "over" : "under"} this
              period’s budget. Not a measure of nutritional needs.
            </p>
            <div className="inline-actions">
              <ActionForm
                submit="Dismiss for this day"
                onSubmit={() => mutate({ type: "acknowledge", date })}
              >
                {null}
              </ActionForm>
              {canReplan && (
                <Button variant="outline" onClick={() => setReplan(true)}>
                  Review replan
                </Button>
              )}
            </div>
          </div>
        </section>
      )}
      {weightEditor && (
        <WeightEditor
          key={`${date}-${weightEditor}`}
          data={data}
          date={date}
          period={weightEditor}
          value={day[weightEditor]}
          mutate={mutate}
          close={() => setWeightEditor(null)}
        />
      )}
      {mealEditor && (
        <MealEditor
          key={mealEditor === "new" ? "new" : mealEditor.id}
          data={data}
          date={date}
          meal={mealEditor === "new" ? undefined : mealEditor}
          defaultPeriod={day.evening === null ? "before" : "after"}
          mutate={mutate}
          close={() => setMealEditor(null)}
        />
      )}
      {replan && (
        <GoalEditor
          data={data}
          mutate={mutate}
          replan
          close={() => setReplan(false)}
        />
      )}
    </>
  );
}

function WeightEditor({
  data,
  date,
  period,
  value,
  mutate,
  close,
}: {
  data: Dataset;
  date: string;
  period: "morning" | "evening";
  value: string | null;
  mutate: Mutate;
  close: () => void;
}) {
  const initial =
    value === null ? "" : inUnits(value, data.units, "weight").toString(12);
  const [remove, setRemove] = useState(false);
  return (
    <Modal
      title={`${value === null ? "Add" : "Edit"} ${period} weight`}
      description={`${date} · ${period === "morning" ? "Morning weight enables food budgeting." : "An evening measurement resets the reference; earlier meals are not subtracted again."}`}
      close={close}
    >
      <ActionForm
        submit={remove ? "Confirm removal" : "Save weight"}
        onSubmit={async (fields) => {
          const input = String(fields.get("weight"));
          await mutate({
            type: "weight",
            date,
            period,
            value: remove
              ? null
              : input === initial && value !== null
                ? value
                : toCanonical(input, data.units, "weight"),
          });
          close();
        }}
        secondary={
          value !== null && (
            <Button
              type="button"
              variant={remove ? "outline" : "destructive"}
              onClick={() => setRemove(!remove)}
            >
              {remove ? "Keep weight" : "Remove weight"}
            </Button>
          )
        }
      >
        {remove ? (
          <p>
            {period === "morning"
              ? "Meals remain in your history, but the budget will be unavailable until a morning weight is restored."
              : "Meals keep their periods, but all meals will count against the morning-based budget until evening weight is restored."}
          </p>
        ) : (
          <Field
            label={`Weight (${unitLabel(data.units, "weight")})`}
            name="weight"
            inputMode="decimal"
            defaultValue={initial}
            required
            autoFocus
          />
        )}
      </ActionForm>
    </Modal>
  );
}

function MealEditor({
  data,
  date,
  meal,
  defaultPeriod,
  mutate,
  close,
}: {
  data: Dataset;
  date: string;
  meal?: Meal;
  defaultPeriod: "before" | "after";
  mutate: Mutate;
  close: () => void;
}) {
  const initial = meal
    ? inUnits(meal.mass, data.units, "mass").toString(12)
    : "";
  const [remove, setRemove] = useState(false);
  return (
    <Modal
      title={meal ? "Edit meal" : "Add meal"}
      description={date}
      close={close}
    >
      <ActionForm
        submit={remove ? "Confirm deletion" : "Save meal"}
        onSubmit={async (fields) => {
          if (remove && meal)
            await mutate({ type: "deleteMeal", date, id: meal.id });
          else {
            const input = String(fields.get("mass"));
            await mutate({
              type: "meal",
              date,
              id: meal?.id ?? crypto.randomUUID(),
              name: String(fields.get("name")).trim(),
              mass:
                meal && input === initial
                  ? meal.mass
                  : toCanonical(input, data.units, "mass"),
              period: fields.get("period") as "before" | "after",
            });
          }
          close();
        }}
        secondary={
          meal && (
            <Button
              type="button"
              variant={remove ? "outline" : "destructive"}
              onClick={() => setRemove(!remove)}
            >
              {remove ? "Keep meal" : "Delete meal"}
            </Button>
          )
        }
      >
        {remove ? (
          <p>
            Delete {meal?.name || "this meal"} from this day? Its mass will be
            removed from the recorded totals.
          </p>
        ) : (
          <>
            <Field
              label="Meal name (optional)"
              name="name"
              defaultValue={meal?.name ?? ""}
              placeholder="Lunch, a snack…"
            />
            <Field
              label={`Food mass (${unitLabel(data.units, "mass")})`}
              name="mass"
              inputMode="decimal"
              defaultValue={initial}
              required
            />
            <div className="field">
              <Label htmlFor="meal-period">Measurement period</Label>
              <NativeSelect
                id="meal-period"
                name="period"
                defaultValue={meal?.period ?? defaultPeriod}
              >
                <option value="before">Before evening weigh-in</option>
                <option value="after">After evening weigh-in</option>
              </NativeSelect>
            </div>
          </>
        )}
      </ActionForm>
    </Modal>
  );
}
