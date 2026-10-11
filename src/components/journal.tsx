import { useEffect, useState } from "react";
import {
  BookOpen,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Scale,
  Settings2,
  Target,
} from "lucide-react";
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
    { id: "journal", title: "Journal", icon: BookOpen },
    { id: "history", title: "History", icon: ChartNoAxesCombined },
    { id: "settings", title: "Settings", icon: Settings2 },
  ] as const;
  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="/" aria-label="Weight Logic home">
          <Scale /> weight logic<span className="brand-dot">.</span>
        </a>
        <nav aria-label="Main navigation">
          {tabs.map(({ id, title, icon: Icon }) => (
            <Button
              key={id}
              variant="ghost"
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
            >
              <Icon />
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
            <p className="eyebrow">
              {tab === "journal"
                ? "Small records. A clearer picture."
                : tab === "history"
                  ? "Every date has a place"
                  : "Private, portable, yours"}
            </p>
            <h1>
              {tab === "journal"
                ? "Your journal"
                : tab === "history"
                  ? "History & progress"
                  : "Settings"}
            </h1>
          </div>
          <Button variant="outline" onClick={() => setGoalEditor(true)}>
            <Target />
            {goal ? "Change goal" : "Set your goal"}
          </Button>
        </div>
        {tab === "journal" && (
          <>
            {!goal && (
              <section className="onboarding">
                <div>
                  <h2>Start with a direction.</h2>
                  <p>
                    Choose a starting weight, a target, and a date. You can
                    adjust the plan as life changes.
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
          <Scale size={17} />
          <p>
            Food mass, not calories. These numbers are an arithmetic record, not
            an eating recommendation. Never fast, dehydrate, or restrict food to
            compensate for a negative budget.
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
