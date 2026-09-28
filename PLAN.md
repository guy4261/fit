# Rebuild fit24 from scratch

This guide consolidates all 23 repository commits through **493f462**, the current source, and the requests in the project conversation as of 28 September 2026. Follow the stages in order to recreate the final app.

## How to use this plan

Place this file in the new project folder. Feed the stage prompts below to the assistant one at a time. Each prompt assumes the assistant can read this entire file, including the shared specification and checkpoint instructions.

Start with Stage 1. After a stage succeeds, use the next prompt. At a recording checkpoint, use its separate recording prompt before continuing. Recordings document that point in the build; they supplement the acceptance checks.

The older README, system diagram, sketches, and videos are useful references but are incomplete descriptions of the final app. This document defines the target.

### Final decisions for every stage

- The name is **fit24**. It is a static, browser-only training log for iPhone and desktop Chrome. Saved training data stays in that browser's localStorage. There is no account, application backend, or remote training database.
- A fresh visit opens **Training history**, including an installed PWA. Starting a workout requires **Start a session**.
- History defaults to newest first. Its order button contains only an arrow, with a descriptive accessible label and tooltip.
- Timing belongs to the session. Only **Session start** is visible. Preserve optional end-time data even though its control is hidden.
- Sets and repetitions remain in the data model, backups, CSV, and achievement calculations. Their editing controls and ordinary workout summaries are hidden. New exercises default to one set and one repetition.
- Load types are **Body, Plates, Barbell, Dumbbell, Kettlebell**, in that order. Build the final wheel/button/plate-count controls below.
- **Whole kg** on the Plates selector displays plain numbers, such as 0, 5, and 25.
- Exercise suggestions include the 18 standard names below and custom names. Matching ignores case, hyphens, and repeated spaces.
- Use vanilla HTML, CSS, and JavaScript. Limit runtime dependencies to the two lazy-loaded QR libraries. A formatter may be a development dependency.
- The finished static files must work on GitHub Pages at a project subpath. Use relative asset paths.
- Use the Tardi mascot, warm cream background, green actions, compact cards, and simple wording from the final design.

## Shared implementation specification

### Files and visual assets

| File or directory | Purpose |
| --- | --- |
| index.html | Main app shell, header, dialogs, entry point |
| app.js | State, rendering, navigation, calculations, import/export |
| style.css | Responsive layout and control styles |
| about.html | About copy, repository link, app sharing |
| manifest.json | PWA metadata |
| service-worker.js | Versioned offline app shell |
| favicon.png | Final 256 × 256 mascot used in favicon, header, splash, and manifest |
| tardi-favicon.png, tardi-favicon-256.png | Original and resized mascot reference assets |
| fit24-qr.svg, fit24-qr.png | Static QR of https://t.ly/fit24 |
| icons/share.svg, icons/github.svg | Reusable SVG assets |
| README.md, SYSTEM-DIAGRAM.md | Final setup, architecture, schema, and limitations |
| deliverables/ | Checkpoint MP4s, disposable sample files, validation notes |

Before rebuilding in an empty directory, preserve the mascot and SVG assets from the old project. Exact artwork requires the original assets. If unavailable, recreate from this brief and identify the result as replacement artwork: a cheerful golden cartoon tardigrade with a red headband, several arms holding a barbell overhead, a dumbbell, kettlebell, and weight plate, plus a thumbs-up, on a transparent background. Keep it readable at favicon size.

The static sharing QR encodes https://t.ly/fit24 exactly. The repository link is https://github.com/guy4261/fit. The existing published path is https://guy4261.github.io/fit/. These are project addresses, not instructions to create redirects or change remote hosting during reconstruction.

Preserve the current nonblocking usage request to https://t.ly/ip-3p, with no training payload and ignored network failures. Rendering and storage must work without it succeeding.

### Appearance and navigation

| Design token | Value |
| --- | --- |
| Background | #f6f4ef |
| Text | #222620 |
| Muted text | #797d74 |
| Border | #e2e2d9 |
| Primary green | #29483d |
| Mint | #dce9dd |
| Lime accent | #d2ec7a |
| Card background | #fffefa |

Use the Inter/system font stack; system fonts are sufficient when Inter is unavailable. Center the header and app at a maximum width of 760 px. Use a sticky header around 64 px tall, rounded cards/buttons, visible focus, safe-area padding, and enough bottom space for mobile actions. Around 480 px, compact and wrap controls without horizontal overflow. Important tap targets should be at least 44 px in each usable dimension.

The main header has mascot/fit24 linking home, trophy linking High Score, About question mark, and share-shaped icon opening **Your data**. Put the GitHub link in the About prose. Give icon controls descriptive labels.

On startup, show a short mascot/name/loading-bar splash and fade it after the first screen renders. Respect reduced motion and include a removal fallback so the splash cannot trap the user.

| Entry | Destination |
| --- | --- |
| Empty hash | Replace with #home while preserving pathname and query |
| #home or #history | Training history |
| #session/<encoded ID> | Saved session |
| #achievements | High Score |
| Missing session or unknown route | Recover to Training history |

Active sessions and forms may use in-memory view state. Confirm before abandoning a nonempty unfinished session through in-app navigation. Draft recovery after refresh is not part of the current app: only finished sessions persist.

### Storage, schema, and compatibility

Use localStorage key **form-training-log-v1**:

~~~json
{
  "sessions": [
    {
      "id": "unique-session-id",
      "date": "2026-09-28T06:00:00.000Z",
      "title": "Sep 28, 2026 Morning",
      "startTime": "09:00",
      "endTime": "",
      "exercises": [
        {
          "name": "Bench Press",
          "sets": 1,
          "reps": 1,
          "weight": { "type": "body" }
        }
      ]
    }
  ],
  "names": ["Custom Movement"]
}
~~~

Use **form-training-log-history-order** for **latest** or **oldest**, defaulting to latest. This preference is outside the training backup. Use unique string IDs, ISO session timestamps, and HH:mm local-time fields. Derive totals rather than persisting them separately.

Supported weight objects:

~~~javascript
{ type: 'body' }
{ type: 'plates', integer: 25, fraction: 0.5 }
{
  type: 'barbell',
  bar: 20,
  side: 15,
  plates: { '1.25': 0, '2.5': 0, '5': 1, '10': 1, '15': 0, '20': 0 }
}
{ type: 'dumbbell', count: 2, each: 10 }
{ type: 'kettlebell', count: 1, kg: 16 }
~~~

Retain the derived barbell **side** field in exports for compatibility. Legacy barbell data without counts remains readable at its old total. On editing, round its per-side amount to the nearest 1.25 kg and decompose into available plates, largest first. A kettlebell without count means one. An unsupported imported dumbbell weight chooses the nearest available wheel value when edited.

Migrate exercise-level times into session fields: prefer existing session values, otherwise earliest exercise start/latest exercise end, otherwise derive start from session date. Strip obsolete per-exercise time properties. Clear a migrated end time that precedes start. Preserve imported sets/reps when their controls are hidden.

Validate an entire import before replacing sessions. Invalid input leaves data intact and produces a useful message. Escape user strings when rendering HTML.

### Training history and session lifecycle

History contains Start a session, Training history, session count, and an empty-state explanation. Each saved row has a date badge, title, exercise count, open-session link, selection checkbox, and Delete button. Keep their interaction areas distinct.

Support confirmed individual and bulk deletion, Select all with partial-selection state, selected count, and a disabled bulk-delete button at zero selections. Persist confirmed changes immediately.

Sort a copy by date. The arrow-only control shows **↑** when its next action is oldest-first and **↓** when its next action is latest-first. Persist the preference; keep an accessible name and tooltip describing that action. Changing order may reset selection.

A new draft has current date/start time, blank end time, no exercises, and a localized medium date plus a part-of-day suffix:

| Local hours | Suffix |
| --- | --- |
| 04:00–11:59 | Morning |
| 12:00–15:59 | Noon |
| 16:00–18:59 | Afternoon |
| 19:00–21:59 | Evening |
| 22:00–03:59 | Night |

Active and saved titles can be edited using pencil/save controls. Trim, require a nonempty value, and enforce a 100-character limit. Show editable Session start. Preserve optional end time and validate end ≥ start when populated; hide its control in the final interface. Finishing permits end time to remain blank.

An active session shows exercise cards with name/load and Edit, Duplicate, Remove. Duplicate inserts an independent deep copy immediately after its source. Add exercise opens a form. Cancel/back returns without applying form edits. Finish persists the session and returns home; empty-session Finish requires confirmation and must be reachable on mobile.

A saved session shows title, date, summary/count, Session start, exercise names/loads, per-exercise Edit, Show QR, and deletion. Saved edits persist. Deletion returns home and is also available through history on mobile.

### Exercise names and previous performance

Seed these exact canonical suggestions:

~~~text
Back Squat
Banded Tricep Pulldown
Bench Press
Bent-Over Row
Deadlift
Hip Thrust
Knee Abduction
Knees to Chest
Pull Over
Pull Up
Push Press
Push Up
Shoulder Lateral Raises
Shoulder Press
Squat
Step Up
Sumo Squat
Triceps Ex
~~~

Require a trimmed name of at most 60 characters; allow custom names. Merge standards, saved names, and imported names into a deduplicated suggestion pool.

Compare by replacing hyphens with spaces, trimming, collapsing repeated whitespace, and folding case. On exact standard matches, use canonical spelling: **push UP** and **Push-Up** become **Push Up**; **bent over row** becomes **Bent-Over Row**. Custom names retain their entered spelling after trimming.

Suggestions must work while typing, when adding another exercise in the same draft, after unlocking a name, and when entering through a direct saved-session URL. Native datalist filtering alone may not match hyphens as spaces; use a small accessible suggestion list if necessary. Canonicalize on selection, name locking, and submission. Bind/update whenever an input is created.

The save-name button turns the input into a label and reveals previous performance; the pencil returns to editing. Show **First time ever!** for no saved matches. Otherwise show **All-time record**, load, and **Today** or **N days ago**. Show **Last time** when its session differs from the record's session. Use identical normalization for suggestions, prior history, and High Score. Use the most recent occurrence to resolve equal maximum loads consistently.

### Weight controls

| Type | Controls | Total |
| --- | --- | --- |
| Body | Default; No external load | 0 internally; Body weight label |
| Plates | Whole kg wheel 0–200; fraction wheel 0, 0.25, 0.5, 0.75; default 0 + 0 | whole + fraction |
| Barbell | Bar − (0), 15, 20 kg; default 0. Per-side counts of 1.25, 2.5, 5, 10, 15, 20 kg plates; +/− and Clear all | bar + 2 × per-side plate sum |
| Barbell with X | Caption changes to Plates for one hand | selected plate sum once |
| Dumbbell | Count one/two, default two; Each (kg) wheel, default 10 | count × each |
| Kettlebell | Illustrated choices; count one/two, default one at 12 kg | count × kg |

Dumbbell wheel values:

~~~text
0, 1.25, 2.5, 4, 5, 6, 7, 8, 9, 10, 12.5, 15, 17.5, 20, 22.5, 25
~~~

| Kettlebell kg | Color | Hex |
| --- | --- | --- |
| 12 | Light blue | #8bd3f0 |
| 16 | Yellow | #f2c94c |
| 20 | Purple | #a98be8 |
| 24 | Green | #64c69a |
| 28 | Orange | #f29a4a |

Wheels support touch scroll, mouse wheel/click, arrow keys, Page Up/Down, Home/End, scroll snap, visible focus, and spinbutton labels/current values. Counts never go negative. Totals update immediately and are read-only.

The Plates Whole kg wheel is unpadded. Combined Plates totals use one decimal for integers (**25.0 kg**) and natural precision for fractions (**25.25 kg**). If retaining the hidden set/repetition wheels, their legacy range is 0–999 with three-digit display; that formatter must not affect Whole kg.

Use unambiguous load labels: two 10 kg dumbbells can read **2 × 10 kg (20 kg total)** or **20 kg total**. Use the combined total exactly once in history and achievements.

### Exercise ordering and QR

Active sessions have a lock/unlock ordering icon. Unlocked mode reveals touch/mouse drag handles and rotations: last-to-first and first-to-last. Disable rotation below two exercises. The icon reflects state; the accessible label describes the next action. Keep edit/duplicate/remove/add/QR actions available in both modes.

| QR feature | Payload | Location |
| --- | --- | --- |
| Share exercise list | JSON array of names in displayed order | Nonempty active and saved session |
| Share backup | Full formatted backup JSON | Your data |

Empty drafts show Scan QR; nonempty drafts show Show QR. Scan a nonempty JSON array of nonblank strings. Create body exercises with sets/reps 1, canonicalize, update suggestions, and close the scanner.

Preserve current scan semantics: duplicate normalized names collapse to their first occurrence, keeping first-appearance order. Displayed session QR can contain repeated names; document that scans deduplicate them.

Prefer the environment-facing camera, decode frames locally, show useful permission/unavailable/invalid-data errors, and stop tracks/animation work on success, cancel, close, and navigation. Release a stream even if a pending permission request returns after the dialog closed.

Lazy-load **jsQR 1.4.0** and **QRCode.js 1.0.0** with the following pinned metadata (or verify equivalent vendored files). Set crossOrigin to anonymous and referrerPolicy to no-referrer. Core app functionality must not depend on them loading. Allow retries after errors.

~~~text
Scanner URL: https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js
Scanner integrity: sha384-b5Ya4Bq3qCyz39m2ISh+4DxjAIljdeFwK/BsXLuj9gugaNwAcj/ia15fxNZL9Nlx
Generator URL: https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js
Generator integrity: sha512-CNgIRecGo7nphbeZ04Sc13ka07paqdeTu0WR1IM4kNcpmBAUSHSQX0FslNhTDadL4O5SAGapGt4FodqL8My0mA==
~~~

Both QR payloads have a 1,200-character limit. Explain oversized payloads; disable oversized backup QR. Use approximately 240 px for backup QR and 260 px for session QR, responsive sizing, and low error correction. First use may require network.

### JSON, CSV, and email

Your data provides JSON export/import, Excel-compatible CSV export/import, email summary, a read-only formatted JSON preview/count, Copy to clipboard, and backup QR.

~~~javascript
{ format: 'form-training-log', version: 1, sessions: [...], names: [...] }
~~~

Both imports **replace saved sessions** and merge suggestions. Explain replacement in the import UI. Backups exclude unfinished drafts. Filenames: **fit24-training-YYYY-MM-DD.json** and **fit24-training-YYYY-MM-DD.csv**.

CSV uses UTF-8 BOM, CRLF, quoted cells, doubled embedded quotes, one row per exercise, and a blank-exercise row for an empty session. Preserve zero-based exercise order. Exact columns:

~~~text
Session ID
Session date
Session title
Session start time
Session end time
Exercise order
Exercise name
Sets
Repetitions
Weight type
Bar kg
Per side kg
1.25 kg plates per side
2.5 kg plates per side
5 kg plates per side
10 kg plates per side
15 kg plates per side
20 kg plates per side
Dumbbells
Each kg
Kettlebell kg
Kettlebell count
Plates whole kg
Plates fraction kg
~~~

Handle quoted commas/newlines/quotes, BOM, blank rows, case-insensitive headers, valid dates/numbers/weight types, stable exercise order, and grouping by session ID (fallback to date + title if an ID cell is empty). Escape formula-like user text with a leading apostrophe on export and undo that marker on import.

Accept legacy Start time/End time headers, absent session-time columns, missing kettlebell count, and old barbell side-only values. Reject partial groups of the six plate columns. Accept HH:mm, optional seconds, and AM/PM; normalize to HH:mm and validate chronology.

Copy uses the Clipboard API and selectable-text fallback. Email prepares a mailto draft titled **My training log**, containing session dates/titles and exercise names/loads. Reject encoded URLs above 1,800 characters with a backup suggestion. Opening a draft does not send mail.

### High Score

The trophy opens **High Score**. Group by normalized name and sort alphabetically. Show highest combined load, stored repetitions, recency, and last performed when more than one occurrence exists. Include an empty state.

Calculate from the highest-load occurrence using stored reps and the shared total helper:

~~~text
Epley 1RM = weight × (1 + reps / 30)
Brzycki 1RM = weight × 36 / (37 − reps)
~~~

Use one decimal and label estimates. Show an em dash for Brzycki at reps ≥ 37. For Body, explain that no loaded-weight estimate is available. Preserve hidden reps through editing/import.

### About and PWA

About explains the author's need to remember exercise weights, local data, and import/export. Include the repository link in prose and the app-sharing QR. Use Web Share where available and copy the app URL otherwise.

Manifest: **fit24 Training Log**, short name **fit24**, start URL/scope **./**, standalone display, cream background/theme, and 256 px mascot. Include an Apple touch icon.

Register a service worker on HTTP(S), cache the local shell/assets, version caches when assets change, remove obsolete app caches, and intercept relevant same-origin GETs. Core screens reopen offline after an online load. Missing non-HTML assets must not receive an HTML fallback. Explain first-use offline limitations for CDN QR libraries.

## Build stages and prompts

### Stage 1 — Foundation, assets, and final landing screen

~~~text
Read PLAN.md completely and implement Stage 1 in this project. Build the vanilla
HTML/CSS/JavaScript shell using the shared specification, final visual tokens,
mascot assets, responsive header, and splash. Add About, including its static
fit24 sharing QR asset/display, and the final routes.
An empty URL must open Training history; explicit saved-session and High Score
routes must be recognized. Add defensive localStorage reads and schema helpers.
Show the empty history state and Start a session entry point. Use relative assets.
Keep unfinished features out of the visible interface until their stage is ready.
Summarize the files created and which Stage 1 acceptance checks passed.
~~~

Acceptance: 390 px and desktop layouts fit; root and #home show history; About returns home; splash disappears; a Pages-style subpath retains working assets; no workout is automatically created.

**Checkpoint A: record the shell.**

### Stage 2 — Complete session flow

~~~text
Read PLAN.md and implement Stage 2 on the existing foundation. Add the complete
active/saved session lifecycle, editable titles and session start time, body-weight
exercise form, add/edit/duplicate/remove, Cancel/back, and Finish. Apply the final
hidden sets/reps/end-time decisions from the shared specification from the start.
Persist finished sessions and keep drafts in memory. Support saved-session editing,
direct session links, migration of old times, and clear abandonment confirmation.
Preserve hidden stored values while editing. Make all primary actions usable on
desktop and mobile. Check the complete create-finish-reopen-edit flow.
~~~

Acceptance: finish two sessions and reload; both survive; drafts do not create saved records; empty-session Finish is reachable on mobile and confirms; duplicate/edit leaves the source independent; cancelling preserves the session; legacy times migrate.

### Stage 3 — Names, all load controls, and prior performance

~~~text
Read PLAN.md and implement Stage 3. Add the exact 18-name suggestion pool plus custom
names, genuine dash/case-insensitive matching while typing, canonical spelling,
name save/edit toggling, and prior-performance hints. Add all five final load panels
with their exact choices, defaults, colors, calculations, and keyboard/touch behavior.
Whole kg must be unpadded. Preserve hidden sets/reps and use one total helper
everywhere. Check fresh forms, unlocked inputs, a second exercise in the same draft,
and direct saved-session entry so suggestions cannot go stale.
~~~

Acceptance: Push-Up and push UP resolve to Push Up; bent over row resolves to Bent-Over Row; new custom names appear in the next form without returning home; Checkpoint B totals match; old barbell/kettlebell data edits correctly; prior-performance hints find normalized historical names.

**Checkpoint B: record exercise entry and weights.**

### Stage 4 — History management and exercise ordering

~~~text
Read PLAN.md and implement Stage 4. Complete Training history with individual
deletion, per-row selection, Select all/partial selection, selected count, confirmed
bulk deletion, and persisted latest/oldest ordering. The order button must contain
only the arrow. Keep session links independent from selection/delete controls.
Add active-session lock/unlock ordering, touch/mouse drag handles, and both rotation
buttons. Preserve exercise values and keep editing actions available during reorder.
Check narrow and wide layouts, including keyboard access.
~~~

Acceptance: newest-first default; reversal survives reload; zero-selected deletion is disabled; cancelling removes nothing; confirming removes exactly selected IDs; row controls never accidentally open sessions; Select all stays accurate; rotations handle zero/one item; final order survives Finish and later export.

**Checkpoint C: record history and ordering.**

### Stage 5 — Complete data portability

~~~text
Read PLAN.md and implement Stage 5. Build Your data with JSON backup, validated
replacement import, formatted preview/count, clipboard fallback, Excel-compatible
CSV export/import, and mailto summary. Follow the exact schema, columns, legacy
compatibility, and limits. Validate before mutating saved data. Use disposable
fixtures to check JSON/CSV round trips for every load type, empty sessions, order,
hidden sets/reps, times, commas, quotes, newlines, and formula-like names. Confirm
malformed imports leave existing data intact. Inspect prepared email drafts/links
without sending messages. Keep fixtures in deliverables; do not seed production users.
~~~

Acceptance: round trips preserve values/order; imports replace sessions and merge names; partial plate-column groups fail clearly; missing old kettlebell count becomes one; copy fallback works; oversized email offers backup.

### Stage 6 — QR display, scanning, and sharing

~~~text
Read PLAN.md and implement Stage 6. Add separate session-name-list and full-backup
QR features, limits, lazy pinned QR libraries, and scanner lifecycle. Empty drafts
show Scan QR, nonempty drafts show Show QR, and saved sessions show QR.
Use the specified normalization, first-occurrence deduplication, and defaults on
scan. Add About's Web Share/copy action beside its existing static QR. Handle camera/network
permissions and release camera tracks on every exit. Perform a real camera scan
when available and identify hardware-dependent checks not performed.
~~~

Acceptance: session QR is names only; backup QR is the full object; scanner rejects a backup object; valid scan creates specified defaults; duplicates follow the documented rule; closing stops camera; oversized or unavailable QR shows useful errors.

**Checkpoint D: record transfer and QR.**

### Stage 7 — High Score and consistent history

~~~text
Read PLAN.md and implement Stage 7. Add High Score with normalized alphabetical
groups, highest load, recency, last performed, and both labeled 1RM estimates.
Use stored reps despite hidden editing controls. Share total calculation and the
latest-occurrence tie rule with prior-performance hints. Cover no history, body
weight, repeated entries, equal maxima, and Brzycki at reps>=37 using demo fixtures.
~~~

Acceptance: with older Bench Press at 60 kg × 5 reps and latest at 50 kg × 8 reps, show record 60 kg, latest 50 kg, and record estimates **70.0 kg Epley**, **67.5 kg Brzycki**. Push-Up/push UP/Push Up form one group. Body has no numeric loaded-weight estimate.

### Stage 8 — PWA, review, and handoff

~~~text
Read PLAN.md and implement Stage 8. Finish manifest/service worker with the final
cache list, relative paths, and update behavior. Confirm installed entry opens
Training history and core saved-data flows work offline after an online load.
Check desktop Chrome and a narrow viewport; check iPhone Safari/Add to Home Screen
if a device is available and identify unperformed device checks. Review focus,
labels, contrast, dialogs, tap targets, overflow, reduced motion, and camera cleanup.
Update README.md and SYSTEM-DIAGRAM.md to match the app. Report meaningful checks
and limitations. Prepare static files for GitHub Pages; publication is a separate
requested action.
~~~

Acceptance: shell and About reopen offline; a new cache version updates assets without losing local data; controls work on both layouts; documentation covers storage scope, drafts, imports, QR limits, and offline limitations.

**Checkpoint E: record final progress and offline flow.**

## Serving and recording checkpoints

### Shared checkpoint rules

Use the installed skills:

- [$serve-local-app](C:/Users/guy42/.codex/skills/serve-local-app/SKILL.md)
- [$chrome-recording](C:/Users/guy42/.codex/skills/chrome-recording/SKILL.md)

Read the actual SKILL.md files when executing a checkpoint. On another machine, resolve the installed skill locations instead of assuming these paths exist.

Serve the project directory at **http://localhost:8000/**, bound only to **127.0.0.1**, following the serving skill. Track the exact process and directory. Reuse a known server for this project if already running; if port 8000 belongs to another or unknown process, report the conflict. Do not silently change ports or stop unrelated processes.

Every prompt below sets **leave_server_running=true**, honoring the user's request to keep the server available until they ask for shutdown. On that later request, stop only the tracked process and confirm shutdown.

Record in visible **Chrome** with the app foreground. Set viewport before capture. Use a disposable Chrome profile/session with isolated storage: another tab in the same profile does not isolate localStorage. Never clear or replace personal training history to create a demo.

Prepare the named synthetic fixture before capture. Use only that isolated data and leave the specified ending state. This authorizes temporary demo entries for the checkpoint; it does not require a production demo-data feature.

Follow the recording skill's Game Bar procedure: note local start time; start exactly once with Win+Alt+R; execute the defined workflow; stop exactly once. If ordinary control cannot send the shortcut, use the skill's provided helper with a distinctive Chrome title substring. On failure after capture starts, make one reasonable attempt to stop it.

Find the new nonempty MP4 in Videos/Captures by recording time and move it into **deliverables/**, reusing the existing case-insensitive directory on Windows. Never overwrite a prior capture; add a timestamp if needed. Verify existence/nonzero size and report the absolute path and duration if available. Report failed capture honestly; screenshots and automation logs are not MP4s.

Save brief results beside recordings in **deliverables/checkpoint-notes.md**: viewport, sample state, checked behavior, and unperformed checks. These are future instructions; this plan does not assert that new recordings already exist.

### Demo fixtures

Use these only in disposable browser state or local sample files. Generate dates relative to execution day.

| Fixture | Contents |
| --- | --- |
| Empty | No sessions or custom names; default latest-first |
| History trio | Demo A three days ago: Push Up/body. Demo B two days ago: Bench Press/50 kg barbell. Demo C yesterday: Squat/25.5 kg Plates |
| Progress | Older session three days ago: Bench Press/60 kg barbell, sets 3/reps 5, plus Push-Up/body. Latest today: Bench Press/50 kg barbell, sets 3/reps 8, plus push UP/body |
| Transfer | One session with all five load types, nonempty session times, nondefault stored sets/reps, and a custom name containing comma/quotes; plus one empty saved session |
| Small QR backup | Empty backup or very small session with actual formatted JSON ≤1,200 characters |
| Oversized backup | Synthetic formatted JSON >1,200 characters |
| QR list card | QR encoding exactly ["Push Up","Bench Press","Squat"], available on a second screen or paper |

For barbells of 50/60 kg, use a 20 kg bar with one 15/20 kg plate per side respectively. Load hidden reps/time fields through validated import after Stage 5 or a development-only fixture setup beforehand. Never replace personal data.

### Checkpoint A — Landing screen and responsive shell

~~~text
Use $serve-local-app and $chrome-recording following PLAN.md checkpoint rules.
leave_server_running=true. Prepare Empty in isolated Chrome at 390x844.
Record deliverables/01-shell-mobile.mp4:
1. Navigate to http://localhost:8000/; show splash resolving to Training history.
2. Show empty history and the Start a session entry point.
3. Open About, show mascot and sharing QR, then use the brand to return home.
4. End on empty Training history without creating a session.
Verify the MP4. Separately inspect at 1280x900 desktop and note overflow/focus
results without expanding the recording workflow.
~~~

### Checkpoint B — Exercise entry and all weights

~~~text
Use $serve-local-app and $chrome-recording following PLAN.md checkpoint rules.
leave_server_running=true. Prepare Empty in isolated Chrome at 390x844.
Record deliverables/02-exercises-and-loads-mobile.mp4:
1. Start a session and rename it "Demo full workout".
2. Add "push UP"; choose/commit canonical Push Up, show its locked name and
   "First time ever!", keep Body, and save.
3. Add Squat with Plates: Whole kg 25 and fraction 0 (25.0 kg total), then
   fraction 0.5 (25.5 kg total), and save.
4. Add Bench Press with Barbell: 20 kg bar plus one 10 kg and one 5 kg plate
   per side (50 kg total); choose X (15 kg for one hand); restore 20 kg;
   save the exercise at 50 kg.
5. Add Shoulder Press with two 10 kg dumbbells (20 kg total).
6. Add Custom Carry with two 16 kg kettlebells (32 kg total).
7. Duplicate Custom Carry, edit the duplicate to one 12 kg kettlebell, then
   remove the duplicate, leaving the original five exercises.
8. Finish, reopen the saved session, and end with its five exercises visible.
Leave this synthetic session in the isolated state. Verify the MP4.
~~~

### Checkpoint C — Selection, deletion, sorting, and order

~~~text
Use $serve-local-app and $chrome-recording following PLAN.md checkpoint rules.
leave_server_running=true. Prepare History trio in isolated Chrome at 1280x900.
Record deliverables/03-history-and-order-desktop.mp4:
1. Open root and show Demo C, Demo B, Demo A newest-first.
2. Click the arrow for Demo A, Demo B, Demo C; reload to show persistence.
3. Delete Demo B: cancel once, then repeat and confirm.
4. Select Demo A; show selected count and partial Select all state.
5. Select all to include Demo C; Delete selected and confirm.
6. Start "Demo order"; add Body exercises Push Up, Squat, Bench Press.
7. Unlock ordering; drag Bench Press first. Rotate last-to-first once and
   first-to-last once. Lock and finish.
8. End on history with Demo order as the only session.
Verify the MP4. Separately check these history controls and touch reordering at
390x844 with disposable data and note the result.
~~~

### Checkpoint D — Backups and QR transfer

~~~text
Use $serve-local-app and $chrome-recording following PLAN.md checkpoint rules.
leave_server_running=true. Prepare Transfer in isolated Chrome at 1280x900.
Record deliverables/04-data-and-qr-desktop.mp4:
1. Open Your data; show formatted JSON/count and Copy.
2. Export JSON and CSV to the demo deliverables area.
3. Import the exported JSON, then CSV; show replacement-import status.
4. Open the multi-exercise saved session and show its exercise-list QR.
5. Close QR, go home, start an empty draft, and open Scan QR.
6. If camera and QR list card are ready, scan and show Push Up, Bench Press,
   Squat in order with Body defaults. If unavailable, show the relevant
   unavailable/denied message, close, and mark successful scan unperformed.
7. Leave the draft through in-app back, confirming discard when applicable.
   End on Training history.
Verify the MP4. Separately use Small QR backup and Oversized backup to check
full-backup QR and limits. End with no active camera.
~~~

### Checkpoint E — Progress and offline readiness

~~~text
Use $serve-local-app and $chrome-recording following PLAN.md checkpoint rules.
leave_server_running=true. Prepare Progress in isolated Chrome at 390x844.
Complete an online load before the offline portion.
Record deliverables/05-final-review-mobile.mp4:
1. Open root and show the two saved sessions on Training history.
2. Open High Score: Bench Press record 60 kg, latest 50 kg, Epley 70.0 kg,
   Brzycki 67.5 kg, and one normalized Push Up group.
3. Return home, start a draft, enter Push-Up, and lock its canonical name to
   show prior-performance hints. Cancel the form and leave the empty draft.
4. Set this Chrome session offline, reload, show history, and open the latest
   saved session. Restore online mode.
5. End on Training history with the original two Progress sessions intact.
Verify the MP4. Note separate desktop, reduced-motion, cache-update, keyboard,
and available iPhone checks. Keep the server running.
~~~

## Completion criteria

- All eight stages implement this single final specification.
- Root URL, direct links, installed start, history order, sessions, and loads behave consistently.
- History management, arrow-only order, canonical autocomplete, and unpadded Whole kg are present.
- Name matching, independent duplicate edits, totals, round trips, and compatibility pass meaningful checks.
- QR errors/limits/permissions, camera shutdown, and offline limitations are handled.
- Five checkpoint recordings exist when capture environments are available. Document unavailable/failed captures rather than claiming completion.
- README and system diagram match the app. Synthetic files/videos stay in deliverables, which can remain Git-ignored.
- The server stays available until the user requests shutdown.

## Historical basis and cautions

These commits identify final requirements; they are not stages to replay.

| Sources | Requirements retained |
| --- | --- |
| c98e1db, 72624c7 | Browser-only log, storage, backup/email/PWA, touch-friendly input |
| bb2114c | Initial README; update it to the completed specification |
| de993cb, 483a08d | Dated sessions, fit24, Plates, name lock/history, reorder/rotate, exercise QR, About |
| fa759d2 | CSV transfer |
| 60415f0 | Compact history without promotional hero |
| 0fdba8e, 3034208 | Saved-exercise editing and final session-level timing/migration |
| 8a5512d | Hidden sets/reps retained in data |
| c824b49 | Intermediate barbell wheel, superseded by the next plate-count design |
| 93d2127 | Final barbell counts, dumbbell choices, legacy weights |
| d3f448f, 90d6131, ec38781 | Asset organization and GitHub link in About |
| d96f4a7, 0715354 | Part-of-day/editable titles, lock/unlock ordering |
| 5c491d9, 1c6a735 | Mascot, colored/countable kettlebells, usage request |
| 46a51e1 | Splash |
| 5c972d0 | High Score |
| 656b9ff | Actual home-first route fix, history controls, standard names, plain Whole kg |
| 493f462 | About wording correction |

The original PLAN.md was the initial brief. SYSTEM-DIAGRAM.md also predates final features. Earlier automatic workout entry, per-exercise times, sliders, intermediate barbell wheel, and letter-f branding are superseded and never become implementation phases.

Acceptance safeguards address current implementation gaps: suggestions bind to each new input and actually match dashes; all grouping uses one normalization; dumbbell labels do not multiply combined totals twice; record ties follow one rule; order-control labels describe actions; empty-session Finish is reachable on mobile. These make intended behavior reliable rather than preserving accidental defects.

Current source keeps end time optional and does not fill it on Finish; its control and sets/reps controls are hidden. Preserve this unless the user requests a change. Scan deduplication and memory-only drafts are explicit above so reconstruction does not silently change them.
