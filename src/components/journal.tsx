import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpen,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings2,
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

export function Journal({
  email,
  installation,
}: {
  email: string;
  installation: ReactNode;
}) {
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
  const selectedDay = new Date(`${date}T12:00:00`);
  const weekday = selectedDay.toLocaleDateString("en-GB", { weekday: "long" });
  const tabs = [
    { id: "journal", title: "Journal", icon: BookOpen },
    { id: "history", title: "History", icon: ChartNoAxesCombined },
    { id: "settings", title: "Settings", icon: Settings2 },
  ] as const;
  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          className="brand flex items-center gap-3"
          href="/"
          aria-label="Weight Logic home"
        >
          <img
            src="/icon.svg"
            alt=""
            width={32}
            height={32}
            className="shrink-0 rounded-sm"
          />
          Weight Logic
        </a>
        <nav aria-label="Main navigation">
          {tabs.map(({ id, title, icon: Icon }) => (
            <Button
              key={id}
              variant="ghost"
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
            >
              <Icon className="nav-icon" aria-hidden="true" />
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
      <main className={`app-main${tab === "journal" ? " daybook" : ""}`}>
        {tab === "journal" && (
          <aside className="date-rail" aria-label="Journal day">
            <div className="date-display">
              <p className="date-month">
                {selectedDay.toLocaleDateString("en-GB", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <p className="date-number">{selectedDay.getDate()}</p>
              <p className="date-weekday">{weekday}</p>
            </div>
            <div className="date-controls">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous day"
                onClick={() => setDate(addDays(date, -1))}
              >
                <ChevronLeft />
              </Button>
              <Button variant="outline" onClick={() => setDate(today)}>
                Today
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next day"
                onClick={() => setDate(addDays(date, 1))}
              >
                <ChevronRight />
              </Button>
            </div>
            <Input
              aria-label="Journal date"
              type="date"
              value={date}
              onChange={(event) => {
                if (event.target.value) setDate(event.target.value);
              }}
            />
          </aside>
        )}
        <div className="page-content">
          <div className="page-heading">
            <div>
              <h1>
                {tab === "journal"
                  ? `${weekday}’s entries`
                  : tab === "history"
                    ? "History & progress"
                    : "Settings"}
              </h1>
            </div>
            {goal && (
              <div className="goal-note">
                {tab === "journal" && (
                  <p>
                    Goal {format(goal.target, data.units, "weight")}{" "}
                    {unitLabel(data.units, "weight")} by{" "}
                    {new Date(`${goal.deadline}T12:00:00`).toLocaleDateString(
                      "en-GB",
                      { day: "numeric", month: "short", year: "numeric" },
                    )}
                  </p>
                )}
                <Button variant="ghost" onClick={() => setGoalEditor(true)}>
                  Change goal
                </Button>
              </div>
            )}
          </div>
          {tab === "journal" && (
            <>
              {!goal && (
                <section className="onboarding">
                  <div>
                    <h2>Set a weight goal</h2>
                    <p>
                      Set your target weight and date, then record your morning
                      weight to see your first food-mass budget.
                    </p>
                  </div>
                  <Button onClick={() => setGoalEditor(true)}>
                    Create your first goal
                  </Button>
                </section>
              )}
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
            <Settings
              data={data}
              mutate={mutate}
              email={email}
              installation={installation}
            />
          )}
          <footer className="app-footer">
            <p>
              Food mass, not calories or an eating recommendation.{" "}
              <button type="button" onClick={() => setTab("settings")}>
                About the calculation
              </button>
            </p>
          </footer>
        </div>
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
