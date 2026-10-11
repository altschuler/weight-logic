import { useState, type ReactNode } from "react";
import { decodeDataset, type Dataset, type Units } from "@weight-logic/domain";
import type { Mutate } from "@/lib/journal";
import { ActionForm, Modal } from "./forms";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { NativeSelect } from "./ui/native-select";
import { Input } from "./ui/input";

export function Settings({
  data,
  mutate,
  email,
  installation,
}: {
  data: Dataset;
  mutate: Mutate;
  email: string;
  installation: ReactNode;
}) {
  const [restore, setRestore] = useState<Dataset | null>(null);
  const [clear, setClear] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  return (
    <div className="settings-stack">
      {installation}
      <section className="panel">
        <h2>Units</h2>
        <ActionForm
          submit="Save preferences"
          onSubmit={async (fields) => {
            await mutate({
              type: "units",
              units: fields.get("units") as Units,
            });
            setNotice("Preferences saved. Physical quantities are unchanged.");
          }}
        >
          <div className="field">
            <Label htmlFor="units">Measurement units</Label>
            <NativeSelect
              key={data.units}
              id="units"
              name="units"
              defaultValue={data.units}
            >
              <option value="metric">Metric · kilograms & grams</option>
              <option value="imperial">Imperial · pounds & ounces</option>
            </NativeSelect>
          </div>
        </ActionForm>
      </section>
      <section className="panel">
        <div className="section-heading">
          <h2>Data</h2>
        </div>
        <p className="muted">{email}</p>
        <div className="settings-row">
          <div>
            <h3>Export your journal</h3>
            <p>Download your complete journal as JSON. Keep it private.</p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(data)], {
                  type: "application/json",
                }),
              );
              const link = document.createElement("a");
              link.href = url;
              link.download = "weight-logic-backup.json";
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Export backup
          </Button>
        </div>
        <div className="settings-row">
          <div>
            <h3>Restore a backup</h3>
            <p>Replace your journal from a backup after confirmation.</p>
          </div>
          <div className="file-picker">
            <Label htmlFor="backup">Choose backup</Label>
            <Input
              id="backup"
              type="file"
              accept=".json,application/json"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setError("");
                setNotice("");
                try {
                  if (file.size > 1_600_000)
                    throw new Error("Backup is too large.");
                  setRestore(decodeDataset(JSON.parse(await file.text())));
                } catch {
                  setError(
                    "This is not a valid Weight Logic backup. Your existing data has not changed.",
                  );
                }
              }}
            />
          </div>
        </div>
        <div className="settings-row">
          <div>
            <h3>Delete journal data</h3>
            <p>Keep your account. Export a backup first.</p>
          </div>
          <Button variant="destructive" onClick={() => setClear(true)}>
            Delete journal data
          </Button>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="success">
            {notice}
          </p>
        )}
      </section>
      <section className="panel model-explanation">
        <h2>About the calculation</h2>
        <p>
          Weight Logic compares your planned evening weight with your actual
          measurement, then subtracts applicable recorded food mass. An evening
          weigh-in resets the reference because it already reflects earlier
          meals and other changes.
        </p>
        <p>
          Food mass is not calories or body-fat change. This calculation does
          not model energy expenditure, hydration, digestion, excretion, or
          metabolism. Only recorded food is counted.
        </p>
        <p>
          A negative budget is an arithmetic difference—not a requirement to
          fast, dehydrate, or compensate. A positive budget is not a
          nutritionally adequate or medically safe eating recommendation.
          Following a budget does not guarantee reaching a goal.
        </p>
      </section>
      {restore && (
        <Modal
          title="Replace your journal?"
          description="This replaces your existing journal data. Your account and sign-in stay unchanged."
          close={() => setRestore(null)}
        >
          <ActionForm
            submit="Replace with backup"
            onSubmit={async () => {
              await mutate({ type: "restore", data: restore, confirmed: true });
              setRestore(null);
              setNotice("Backup restored.");
            }}
          >
            <p>
              The backup contains {restore.days.length} days,{" "}
              {restore.days.reduce((n, day) => n + day.meals.length, 0)} meals,
              and {restore.goals.length} goals.
            </p>
          </ActionForm>
        </Modal>
      )}
      {clear && (
        <Modal
          title="Delete journal data?"
          description="This permanently deletes your journal data, but keeps your account. It cannot be undone without a backup."
          close={() => setClear(false)}
        >
          <ActionForm
            submit="Confirm deletion"
            onSubmit={async () => {
              await mutate({ type: "clear", confirmed: true });
              setClear(false);
              setNotice("Journal data deleted. Your account remains active.");
            }}
          >
            <p>
              Measurements, meals, goals, preferences, and acknowledgements will
              be removed.
            </p>
          </ActionForm>
        </Modal>
      )}
    </div>
  );
}
