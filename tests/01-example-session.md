# Scenario 1: Review the initial example session

## Setup
Open Fit24 on a fresh browser origin with no saved Fit24 data.

## Steps
1. Open the home page.
2. Review the `Example Session` dated 2026-01-01.
3. Open it and verify it contains five built-in exercises, one each for Body, Plates, Barbell, Dumbbell, and Kettlebell, with 1–3 recorded sets each.
4. Return to history and verify the sample is an ordinary saved session with a Delete action.

## Expected
The first-run history contains the sample session with the stated date and exercise/weight coverage. It can be reviewed, edited, or deleted through the normal session controls.

## Run result
PASS on 2026-09-29 using a fresh `127.0.0.1` origin: confirmed the sample date, five load types, set counts, and the session Delete action in history.
