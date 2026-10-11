# Scenario 3: Record each load type

## Setup
Start a new session and add an exercise named `Squat`.

## Steps
1. Save the exercise name.
2. In turn, select Body, Plates, Barbell, Dumbbell, and Kettlebell.
3. Verify each selector is visible and usable; verify the initial Barbell bar weight is 0, Dumbbell weight includes 0, and Kettlebell starts at 12.
4. Stamp one set for each type, then select Done and inspect the exercise summary.
5. Add an exercise with two dumbbells weighing 8 kg each, stamp a set, and select Done. Verify the summary shows `16 kg`, without a `2 ×` prefix. Repeat with one 8 kg dumbbell and verify `8 kg`.

## Expected
Each weight type records a distinct set using its selected weight and the chosen Reps. The initial values match the documented defaults, and all five sets are retained.
The dumbbell summary shows the combined weight exactly once: two 8 kg dumbbells show `16 kg`, and one shows `8 kg`.

## Run result
PASS on 2026-09-29: recorded one set for each of the five weight types; observed Barbell 0, Dumbbell 0, and Kettlebell 12 defaults; retained all five sets.
