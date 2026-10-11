# Weight Logic: product specification

## Purpose and scope

Create a web application for tracking body weight against a dated weight goal, using the mass of food eaten between weigh-ins to calculate a remaining food-mass budget.

The defining principle is **food mass, not calories**. A daily planned evening weight is compared with an actual weigh-in. The difference, expressed in grams, is the available mass budget; meals recorded after that weigh-in reduce it. An evening weigh-in resets the accounting to an actual measurement rather than carrying forward estimated intake from the morning.

This document is a standalone functional handoff. It specifies product behavior and the meaning of data, not screens, visual design, programming languages, storage technology, or architecture.

## Limits of the model

- The weight trajectory is a user-selected plan, not a prediction of future body weight.
- Food mass is not equivalent to body-fat gain or loss. The calculation does not model calories, energy expenditure, hydration, digestion, excretion, or metabolic adaptation.
- A remaining mass budget is an arithmetic estimate, not a nutritionally adequate or medically safe eating recommendation.
- A negative budget means the current measurement and recorded intake exceed the planned weight. It must not be described as a requirement to fast, dehydrate, or compensate by unhealthy restriction.
- The application must explain these limitations. Do not claim that following the budget guarantees reaching the goal.

## Information the product keeps

The following are logical data types, not a prescribed technical representation. Missing values are distinct from zero.

### Daily weight record

There is at most one record per calendar date.

| Information | Meaning / type |
| --- | --- |
| Date | Calendar date, without time of day |
| Morning weight | Optional positive decimal body weight, in kilograms |
| Evening weight | Optional positive decimal body weight, in kilograms |
| Adjustment acknowledged | Boolean, initially false; remembers that the user accepted or dismissed that day's adjustment suggestion |

A day can have either measurement, both, or neither. An evening-only record is valid weight history, but does not enable food budgeting under the morning-weight requirement below. Morning and evening are measurement categories, not inferred clock-time cutoffs.

### Meal record

Each meal belongs to one daily record. A day may have any number of meals.

| Information | Meaning / type |
| --- | --- |
| Day | The calendar date to which the meal belongs |
| Mass | Non-negative decimal amount in grams |
| Name | Optional text, with no effect on calculations |
| Measurement period | Before or after that day's evening weigh-in |
| Recorded time | Timestamp, distinct from the calendar date the meal belongs to |

The measurement-period classification determines which budget the meal affects. The timestamp alone does not determine this. By default, a new meal is classified as after-evening if the day already has an evening weight; otherwise it is before-evening. Correcting a meal must allow its period to remain accurate. Editing its name or mass must not silently move it between periods.

There is no nutritional composition, food database, calorie count, or meal-specific conversion factor. Every recorded gram has the same arithmetic effect. Only recorded intake is counted; no intake is inferred.

### Goal period

Goals form a dated history rather than one mutable global goal.

| Information | Meaning / type |
| --- | --- |
| Activation date | Calendar date on which the goal starts applying |
| Starting weight | Positive decimal kilograms, providing the baseline when no qualifying measurement exists |
| Target weight | Positive decimal kilograms |
| Target date | Calendar date on which the target weight should be reached |

There is at most one goal per activation date. A second change on the same date replaces that date's goal. A change on a later date retains earlier goal periods.

### Preferences

The user chooses metric or imperial units. Body weight uses kilograms or pounds; meal mass and food budgets use grams or ounces. Unit changes do not change the physical quantities or historical results.

## Calendar and numerical rules

- Daily calculations use whole calendar-day differences, not elapsed 24-hour intervals. Daylight-saving transitions must not create fractional or missing days.
- “Today” follows the user's local calendar. Previously recorded dates must not shift when viewed in another timezone.
- Weight and food mass may contain fractional values. Do not round intermediate calculations; presentation rounding must not feed back into calculations.
- Unit relationships: 1 kg = 1,000 g; 1 lb = 0.45359237 kg; 1 oz = 28.349523125 g.
- Calculations and thresholds refer to the same physical quantities regardless of the chosen units. Rates retain their direction: loss, maintenance, and gain are not interchangeable absolute values.
- Reject invalid dates, non-finite amounts, non-positive body weights, and negative meal masses. Do not introduce arbitrary medical weight or rate limits as though they were part of this algorithm.

## Starting and maintaining a record

The user establishes a starting weight, target weight, and target date. The first goal activates today. The starting weight supplies a baseline even if no morning measurement has been recorded.

The user can review previous dates, record or correct morning and evening measurements, and add, correct, or delete meals. Corrections recalculate dependent results. Recording the same measurement category again updates that day's value rather than adding another weigh-in.

Morning weight is required before adding meals or calculating a food budget for a day. If a morning weight is subsequently removed, existing meals remain history, but the budget becomes unavailable until morning weight is restored.

Removing an evening measurement must not silently reclassify its meals. Until an evening measurement is restored, all meals for the day count against the morning-based budget, because none can be considered accounted for by an evening measurement.

Actual measurements, planned weights, and missing measurements must always remain distinguishable. Never fabricate an actual measurement from a goal or from another date.

## Daily planned weight

For a date D, use the goal with the latest activation date on or before D. If there is none, the planned weight and food budget are unavailable.

Determine that goal's baseline B as follows:

1. Find the most recent date on or before activation that has an actual body-weight measurement.
2. On that date, prefer evening weight to morning weight.
3. If there is no such measurement, use the goal's stored starting weight.

Empty daily records do not hide earlier measurements. Measurements after activation do not automatically rebase the goal. Correcting a measurement used as its baseline does recalculate that goal period; a historical correction can therefore change historical planned values.

Let G be the target weight, N the calendar days from activation to target date, and E the calendar days from activation to D.

```text
planned daily loss in kg = (B − G) / N
planned weight on D in kg = B − planned daily loss × E
```

These formulas apply from activation until the target date. On the activation date, the planned weight is B. At and after the target date, it is G: the plan enters maintenance and does not extrapolate below the goal.

A new goal's target date must be later than its activation date. Existing historical goals may have deadlines in the past; they remain valid and use maintenance behavior. If B equals G, the trajectory is flat. If G is above B, the same arithmetic describes gain, which must be named accurately rather than reported as positive loss.

All planned-weight outputs must agree with these rules, including historical comparisons and future projections. A new goal may introduce a discontinuity when it rebases to actual weight; do not conceal that by using a different projection formula.

## Food-mass accounting

For a day with morning weight and an applicable goal:

```text
reference weight = evening weight if present, otherwise morning weight
gross mass budget in grams = (planned weight − reference weight) × 1,000
remaining mass budget = gross mass budget − applicable recorded meal mass
```

Before the evening measurement, applicable meal mass is all intake recorded for the day. After the evening measurement, it is only meals classified as after-evening.

The evening measurement already reflects the body's state after earlier meals and other changes. Subtracting those earlier meals again would double-count them. Earlier meals remain in the daily intake history and total, but no longer reduce the evening-based budget.

The product must make these quantities available as distinct facts:

- Planned evening weight and actual morning/evening measurements.
- Gross mass budget relative to the current reference measurement.
- Meal mass before evening, meal mass after evening, and total recorded meal mass.
- Remaining mass budget, including negative values.

Do not clamp a negative budget to zero, carry an unused budget to the next day, or automatically change a goal when a day ends above or below plan. Each day uses its own target, measurements, and meals.

### Worked example

Today's planned weight is 80.0 kg and morning weight is 79.2 kg. The morning-based gross budget is 800 g. Two meals of 250 g and 180 g leave 370 g.

An evening measurement of 79.7 kg replaces the reference weight. The new gross budget is 300 g; the earlier 430 g is not subtracted again. A subsequent 120 g meal leaves 180 g. Total recorded food for the day is still 550 g.

If evening weight instead measures 80.2 kg, the gross budget is −200 g. A subsequent 120 g meal produces a remaining budget of −320 g. These are arithmetic differences, not instructions to lose that mass immediately.

## Goal changes and adjustment feedback

### Explicit goal changes

The user can change target weight, deadline, or both. Ordinary changes activate today, not on a historical date merely being reviewed.

Before committing a change, provide the latest actual weight on or before today, its measurement date, the proposed target and deadline, remaining days, and required daily rate. If there is no actual measurement, explicitly identify the existing goal baseline as the fallback rather than calling it a measured current weight.

For a meaningful comparison, calculate both the existing goal's required rate from today's reference weight and the proposed goal's required rate from that same weight and date. Distinguish these from the original plan's fixed daily rate. A deadline with no remaining days has no finite required future rate; do not divide by zero or claim a zero rate reaches a different weight immediately.

Committing creates or replaces today's goal using that baseline. Cancelling changes nothing. Earlier goal periods remain applicable to earlier dates.

### Deviation feedback

Deviation describes whether recorded intake exceeds or falls short of the budget for the current measurement period:

```text
deviation in grams = applicable recorded meal mass − gross mass budget
```

Positive means over budget; negative means under budget. A significant deviation has an absolute value strictly greater than 100 g. Exactly +100 g or −100 g does not cross the threshold. This is a product feedback threshold, not a medical threshold or evidence that a day's food record is complete.

Only calculate deviation when a food budget is available. The user can acknowledge/dismiss a day's suggestion without modifying measurements, meals, or the plan. Acknowledgement persists for that day; ordinary edits do not repeatedly reopen the same suggestion. Manual goal changes remain available.

### Replanning from actual weight

The user may explicitly replan from today's latest actual weight while retaining the current goal weight and future deadline. The proposed daily rate is:

```text
proposed daily loss = (today's latest measured weight − target weight)
                     / remaining calendar days
```

Show the existing plan's daily rate, the proposed rate, and remaining days. No goal changes occur without acceptance. Acceptance creates or replaces today's goal period and acknowledges today's suggestion. It must actually change the trajectory, not merely dismiss feedback.

This action requires a measurement today and a deadline after today. Historical deviations may be reviewed but must not silently rewrite historical goals. If the deadline has passed, the user must choose a new deadline to replan. The deviation amount itself is not added to body weight: recorded food mass is not a substitute for a new measurement.

## History, progress, and projections

The user can review recorded morning/evening weights, meals, goal history, and planned weights for historical dates, and inspect the future planned trajectory through the deadline and into maintenance. Missing weigh-ins remain gaps, not interpolated measurements.

Provide these overall statistics through today, excluding any future-dated measurements:

- **Current measured weight:** the most recent actual measurement, evening preferred on its date, with that date identified.
- **Starting weight:** the resolved baseline of the earliest goal; if no goals exist, use the earliest measured day's morning weight, otherwise its evening weight. With neither, it is unavailable.
- **Total weight lost:** starting weight minus current measured weight. A negative result means gain.
- **Average daily loss:** earliest measured day's representative weight minus latest measured day's representative weight, divided by calendar days between those dates. Prefer evening on each date. This is an endpoint average, not a fitted trend or average of individual day-to-day changes. With fewer than two distinct measured dates, the rate is unavailable.
- **Goal completion:** total weight lost divided by starting weight minus the currently applicable goal weight, expressed as a percentage and bounded to 0–100%. This loss-oriented percentage is unavailable when the denominator is zero or negative. Raw weight changes must still retain their signs.
- **Days remaining:** calendar days until the current goal's deadline, bounded below by zero; distinguish maintenance from an active countdown.

Changing a goal can change the completion percentage without changing any actual weight history. Projected values must use the same daily-target rules as food budgeting, not a separate smoothed or visually continuous approximation.

## Persistence, portability, and privacy

- Recorded measurements, meals, goals, preferences, and daily acknowledgement state survive closing and reopening the application.
- The user can export a complete personal-data backup and restore it, preserving dates, quantities, meal classifications, and relationships.
- Restoration replaces the existing dataset only after explicit confirmation. Invalid or incomplete backups must not erase existing data or leave a partial restoration.
- The user can deliberately clear their data after confirmation. Routine changes must not delete unrelated history.
- Personal weight and meal history must not be publicly accessible by default. Account structure, authentication, sharing, synchronization, and hosting are separate decisions, not implied by this specification.

## Functional acceptance examples

| Situation | Required result |
| --- | --- |
| Baseline 82 kg on October 1; goal 80 kg on October 11 | Daily loss 0.2 kg; October 1 target 82 kg; October 4 target 81.4 kg; October 11 and later target 80 kg |
| On October 5, a new goal starts at a measured 81.7 kg and targets 80.5 kg on October 11 | New daily loss 0.2 kg; October 6 target 81.5 kg; October 4 still follows the earlier goal |
| Another goal change is made on October 5 | Replace the October 5 goal, retaining goals from earlier dates |
| New measurements occur after goal activation | Update observed progress and that day's budget, but do not automatically change the goal's slope |
| Target 80 kg, morning 79.2 kg, meals 250 g and 180 g | Gross budget 800 g; remaining 370 g |
| Then evening 79.7 kg and an after-evening meal of 120 g | Gross budget 300 g; remaining 180 g; total daily food 550 g |
| Evening weight is removed from that example | Morning-based remaining budget 250 g; all 550 g of meals counted |
| Deviation is +100 g, −100 g, +101 g, or −101 g | Only the latter two are significant |
| Evening weight exists but morning weight is missing | Weight history is available; food budget and deviation are unavailable |
| A date has no applicable goal | Measurements and meals remain history; no planned weight or food budget is fabricated |
| First representative measurement 82 kg; last 80.8 kg six calendar days later | Endpoint-average loss 0.2 kg/day, regardless of missing intervening dates |
| User switches unit preference | Same physical weights, budgets, thresholds, and progress; only units change |
| User dismisses adjustment feedback | No change to the goal trajectory |
| User accepts today's replan | Today's goal baseline uses today's measurement; subsequent targets follow the accepted rate |

## Outside this product scope

No calorie or macro tracking, exercise compensation, BMI/body-composition calculations, automated medical advice, regression forecasts, moving-average trends, social features, wearable integration, or automatic goal adjustment is required.
