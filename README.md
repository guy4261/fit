# Fit24 - My Fitness Tracking App

## Live workout screen scanning

In an active session, tap **Scan screen**, allow camera access, and point at the workout board. Tap **Read exercises** while holding still. The camera stays open, so you can move closer and read additional panels. Exact duplicate names and common workout headings are skipped. Tap **Review** to edit or remove names, then **Add exercises**. These exercises start with zero sets; record sets later through **Edit**. **Scan more** returns to the camera without losing the list.

Frames are passed directly to browser OCR as canvases, without inline base64 images or video recording. The first read needs internet to load the OCR engine. Closing the scanner stops the camera; switching away pauses it and offers **Retry camera** when you return. The existing **Photo** button remains available.

Desktop development can use `http://localhost:8080`. To use the computer-hosted app from iPhone Safari, use an HTTPS address with a trusted certificate: the computer's HTTP LAN address is not a secure camera context, and `localhost` on iPhone points to the iPhone itself.

Browser regression: `node tests/live-scan.cjs` (Playwright and Chrome required; supports `PLAYWRIGHT_MODULE`). This uses a simulated video stream and OCR responses to check the interaction and zero-set import; real iPhone camera/OCR accuracy still needs device testing.

* Live: https://t.ly/fit24
* Code: https://github.com/guy4261/fit


## Data Model

ExerciseNames = [
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
]

Session
  Start DateTime
  Exercise[]
    Name
    Weight?

Weight
	^Type
	/Total

BAR_WEIGHT =         [10, 20]
BARBELL_PLATES =     [1.25, 2.5, 5, 10, 15, 20]
                     # The 1.25, 2.5 really are very small plates sometimes used by trainees.
DUMBBELL_WEIGHTS =   [4, 5, 6, 7, 8, 9, 10, 12.5, 15, 17.5, 20, 22.5, 25]  # +BARBELL_PLATES
KETTLEBELL_WEIGHTS = [12, 16, 20, 24, 28]

BodyWeight(Weight)

Dumbbell(Weight)

Barbell(Weight)

Kettlebell(Weight)

Plates(Weight)



Your data is a List of Sessions.
A Session has a starting timestamp and a List of Exercises.
An Exercise has an Exercise Name.

## Development

This app is designed to run entirely in your browser (Desktop or Phone).

Everything is stored locally (which is why you don't need to login). Data import/export options are available.

When developing, serve `index.html` and the static assets.

I personally use `python -m http.server` and browse to `http://localhost:8000` but you can have it your way.

I am developing in Windows, using Google Chrome (and it's Developer Tools' Mobile mode) and testing using my iPhone/Safari.

The live version is stored on [GitHub Pages](https://guy4261.github.io/fit).

Please use (and share) [this link](https://t.ly/fit24) though to help me (humbly) track usage.
