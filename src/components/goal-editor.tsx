import { useState } from "react";
import {
  addDays,
  format,
  goalAt,
  goalPreview,
  inUnits,
  localToday,
  toCanonical,
  unitLabel,
  type Dataset,
  type Command,
} from "@weight-logic/domain";
import type Fraction from "fraction.js";
import type { Mutate } from "@/lib/journal";
import { ActionForm, Field, Modal } from "./forms";
import { Button } from "./ui/button";

export const rateLabel = (rate: Fraction | null, data: Dataset) =>
  rate === null
    ? "Unavailable"
    : rate.equals(0)
      ? "Maintenance (0 per day)"
      : `${format(rate.abs(), data.units, "weight", 4)} ${unitLabel(data.units, "weight")}/day ${rate.compare(0) > 0 ? "loss" : "gain"}`;

export function GoalEditor({
  data,
  mutate,
  close,
  replan = false,
}: {
  data: Dataset;
  mutate: Mutate;
  close: () => void;
  replan?: boolean;
}) {
  const today = localToday();
  const existing = goalAt(data, today);
  const [proposal, setProposal] = useState<{
    command: Command;
    target: string;
    deadline: string;
    start?: string;
  } | null>(
    replan && existing
      ? {
          command: { type: "replan" },
          target: existing.target,
          deadline: existing.deadline,
        }
      : null,
  );
  const initialTarget = existing
    ? inUnits(existing.target, data.units, "weight").toString(12)
    : "";
  const preview = proposal
    ? goalPreview(
        data,
        today,
        proposal.target,
        proposal.deadline,
        proposal.start,
      )
    : null;
  return (
    <Modal
      close={close}
      title={
        replan
          ? "Replan from today"
          : existing
            ? "Change your goal"
            : "Start with a plan"
      }
      description={`Starts today, ${today}. Earlier goal periods stay in your history.`}
    >
      {proposal && preview ? (
        <ActionForm
          submit={replan ? "Accept replan" : "Confirm goal"}
          onSubmit={async () => {
            await mutate(proposal.command);
            close();
          }}
          secondary={
            <Button
              type="button"
              variant="outline"
              onClick={() => (replan ? close() : setProposal(null))}
            >
              Cancel
            </Button>
          }
        >
          <dl className="preview-list">
            <div>
              <dt>
                {preview.current
                  ? `Latest measurement · ${preview.current.date}`
                  : "Fallback baseline · not a measurement"}
              </dt>
              <dd>
                {format(preview.reference, data.units, "weight")}{" "}
                {unitLabel(data.units, "weight")}
              </dd>
            </div>
            <div>
              <dt>Target · {proposal.deadline}</dt>
              <dd>
                {format(proposal.target, data.units, "weight")}{" "}
                {unitLabel(data.units, "weight")}
              </dd>
            </div>
            <div>
              <dt>Days remaining</dt>
              <dd>{preview.remaining}</dd>
            </div>
            {existing && (
              <>
                <div>
                  <dt>Original plan’s fixed rate</dt>
                  <dd>{rateLabel(preview.originalRate, data)}</dd>
                </div>
                <div>
                  <dt>Existing goal’s required rate from today</dt>
                  <dd>{rateLabel(preview.existingRequiredRate, data)}</dd>
                </div>
              </>
            )}
            <div>
              <dt>Proposed rate from today</dt>
              <dd>{rateLabel(preview.proposedRate, data)}</dd>
            </div>
          </dl>
          <p className="muted">
            A chosen plan, not a prediction or eating recommendation. Your
            planned line may jump to the new baseline.
          </p>
        </ActionForm>
      ) : (
        <ActionForm
          submit="Review goal"
          onSubmit={async (fields) => {
            const targetInput = String(fields.get("target"));
            const target =
              existing && targetInput === initialTarget
                ? existing.target
                : toCanonical(targetInput, data.units, "weight");
            const deadline = String(fields.get("deadline"));
            if (deadline <= today)
              throw new Error("Choose a target date after today.");
            const start = !existing
              ? toCanonical(String(fields.get("start")), data.units, "weight")
              : undefined;
            setProposal({
              target,
              deadline,
              start,
              command: {
                type: "goal",
                target,
                deadline,
                ...(start ? { start } : {}),
              },
            });
          }}
        >
          {!existing && (
            <Field
              label={`Starting weight (${unitLabel(data.units, "weight")})`}
              name="start"
              inputMode="decimal"
              required
              placeholder={data.units === "metric" ? "82" : "180"}
            />
          )}
          <Field
            label={`Target weight (${unitLabel(data.units, "weight")})`}
            name="target"
            inputMode="decimal"
            required
            defaultValue={initialTarget}
            placeholder={data.units === "metric" ? "80" : "176"}
          />
          <Field
            label="Target date"
            name="deadline"
            type="date"
            required
            min={addDays(today, 1)}
            defaultValue={
              existing && existing.deadline > today
                ? existing.deadline
                : addDays(today, 60)
            }
          />
          <p className="muted">
            Loss, maintenance, and gain goals are all supported.
          </p>
        </ActionForm>
      )}
    </Modal>
  );
}
