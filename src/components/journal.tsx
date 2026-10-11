import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import {
  addDays,
  format,
  goalAt,
  localToday,
  unitLabel,
} from "@weight-logic/domain";
import { useJournal } from "@/lib/journal";
import { authClient } from "@/lib/auth-client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { DayJournal } from "./day-journal";
import { GoalEditor } from "./goal-editor";
import { History } from "./history";
import { Settings } from "./settings";

export function Journal({ email }: { email: string }) {
  const { data, error, load, mutate } = useJournal();
  const [today, setToday] = useState(localToday);
  const [date, setDate] = useState(localToday);
  const [tab, setTab] = useState<"journal" | "history" | "settings">("journal");
  const [goalEditor, setGoalEditor] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setToday(localToday()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!data)
    return (
      <main className="loading">
        {error ? (
          <>
            <p role="alert" className="error">
              {error}
            </p>
            <Button onClick={() => void load()}>Try again</Button>
          </>
        ) : (
          <p role="status">Loading your journal…</p>
        )}
      </main>
    );
  const goal = goalAt(data, today);
  const tabs = [
    { id: "journal", title: "Journal" },
    { id: "history", title: "History" },
    { id: "settings", title: "Settings" },
  ] as const;
  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="/" aria-label="Weight Logic home">
          weight logic
        </a>
        <nav aria-label="Main navigation">
          {tabs.map(({ id, title }) => (
            <Button
              key={id}
              variant="ghost"
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
            >
              {title}
            </Button>
          ))}
        </nav>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Sign out"
          onClick={() => void authClient.signOut()}
        >
          <LogOut />
        </Button>
      </header>
      <main className="app-main">
        <div className="page-heading">
          <div>
            <h1>
              {tab === "journal"
                ? "Your journal"
                : tab === "history"
                  ? "History & progress"
                  : "Settings"}
            </h1>
          </div>
          {goal && (
            <Button variant="ghost" onClick={() => setGoalEditor(true)}>
              Change goal
            </Button>
          )}
        </div>
        {tab === "journal" && (
          <>
            {!goal && (
              <section className="onboarding">
                <div>
                  <h2>Set a weight goal</h2>
                  <p>
                    Choose a starting weight, target weight, and target date.
                  </p>
                </div>
                <Button onClick={() => setGoalEditor(true)}>
                  Create your first goal
                </Button>
              </section>
            )}
            <div className="date-toolbar">
              <div className="date-controls">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Previous day"
                  onClick={() => setDate(addDays(date, -1))}
                >
                  <ChevronLeft />
                </Button>
                <Input
                  aria-label="Journal date"
                  type="date"
                  value={date}
                  onChange={(event) => {
                    if (event.target.value) setDate(event.target.value);
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Next day"
                  onClick={() => setDate(addDays(date, 1))}
                >
                  <ChevronRight />
                </Button>
                <Button variant="ghost" onClick={() => setDate(today)}>
                  {date === today ? "Today" : "Go to today"}
                </Button>
              </div>
              <p className="muted">
                {goal ? (
                  <>
                    Goal{" "}
                    <strong>
                      {format(goal.target, data.units, "weight")}{" "}
                      {unitLabel(data.units, "weight")}
                    </strong>{" "}
                    by {goal.deadline}
                  </>
                ) : (
                  "No active goal"
                )}
              </p>
            </div>
            <DayJournal
              key={date}
              data={data}
              date={date}
              today={today}
              mutate={mutate}
            />
          </>
        )}
        {tab === "history" && (
          <History
            data={data}
            today={today}
            openDay={(date) => {
              setDate(date);
              setTab("journal");
            }}
          />
        )}
        {tab === "settings" && (
          <Settings data={data} mutate={mutate} email={email} />
        )}
        <footer className="app-footer">
          <p>
            Food mass, not calories or an eating recommendation.{" "}
            <button type="button" onClick={() => setTab("settings")}>
              About the calculation
            </button>
          </p>
        </footer>
      </main>
      {goalEditor && (
        <GoalEditor
          data={data}
          mutate={mutate}
          close={() => setGoalEditor(false)}
        />
      )}
    </div>
  );
}
