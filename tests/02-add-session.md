# Scenario 2: Add an exercise and record sets

## Setup
Start from the home page.

## Steps
1. Start a training session and add an exercise.
2. Before saving the name, verify only the exercise name input, floppy disk button, and Cancel are shown.
3. Enter `Bench Press` and save the name.
4. Verify the load type, weight controls, Reps selector, stamp, Sets row, and Cancel / Done actions appear.
5. Choose a low Reps value, stamp a set, change Reps and stamp a second set.
6. Select Done, then finish the session.
7. Reload the app.

## Expected
The exercise can only be saved by stamping at least one set; the session appears in history with the recorded exercise and survives reload.

## Run result
PASS on 2026-09-29: confirmed the initial name-only view, saved `Bench Press`, recorded 5-rep and 8-rep sets, saved and finished the session, and verified it after reload.
