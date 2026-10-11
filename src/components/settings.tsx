import { useState } from "react";
import { Download, Upload, ShieldCheck } from "lucide-react";
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
}: {
  data: Dataset;
  mutate: Mutate;
  email: string;
}) {
  const [restore, setRestore] = useState<Dataset | null>(null);
  const [clear, setClear] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  return (
    <div className="settings-stack">
      <section className="panel">
        <h2>Make it yours</h2>
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
            <p className="muted">
              Only display units change. Your history and physical quantities
              stay the same.
            </p>
          </div>
        </ActionForm>
      </section>
      <section className="panel">
        <div className="section-heading">
          <h2>Your data, in your hands</h2>
          <ShieldCheck size={22} />
        </div>
        <p className="muted">
          Signed in as {email}. Your weight and meal history is private to this
          account. Backups contain personal tracking data; store them somewhere
          safe.
        </p>
        <div className="settings-row">
          <div>
            <h3>Export your journal</h3>
            <p>
              All measurements, meals, goals, units, and acknowledgements in one
              versioned JSON backup.
            </p>
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
            <Download /> Export backup
          </Button>
        </div>
        <div className="settings-row">
          <div>
            <h3>Restore a backup</h3>
            <p>
              The file is checked before you confirm replacement. Invalid files
              never erase your journal.
            </p>
          </div>
          <div className="file-picker">
            <Label htmlFor="backup">
              <Upload size={16} /> Choose backup
            </Label>
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
            <h3>Clear tracking data</h3>
            <p>
              Remove the journal, but keep your account. Export a backup first
              if you want to restore it later.
            </p>
          </div>
          <Button variant="destructive" onClick={() => setClear(true)}>
            Clear tracking data
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
        <p className="eyebrow">Understand the numbers</p>
        <h2>A plan, not a prescription</h2>
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
          description="This replaces all existing tracking data. Your account and sign-in stay unchanged."
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
          title="Clear your journal?"
          description="This permanently removes tracking data from this account. It cannot be undone without a backup."
          close={() => setClear(false)}
        >
          <ActionForm
            submit="Confirm clear"
            onSubmit={async () => {
              await mutate({ type: "clear", confirmed: true });
              setClear(false);
              setNotice("Tracking data cleared. Your account remains active.");
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
