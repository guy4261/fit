I want to create a fitness app.
It will be hosted as a single page app or PWA (something you Add to Home Screen on your iPhone), hosted on GitHub (e.g. https://guy4261.github.io/fitness/). During development it should be served from localhost. It is a mobile browser app but should be usable from Google Chrome for local testing.
There will be no server side - everything will be stored on the client side using the browser's localStorage or IndexedDB. Hence I'm expecting code to be in JavaScript or TypeScript compiled to JavaScript - something running in the browser.

Please try to avoid 3rd party libraries as much as possible. Rely on vanilla JavaScript and HTML capabilities. UI/UX should be simple.

When the user enters the app, she sees the list of previous training sessions (if any) and can start a new one.
Starting a new one moves to an active session screen.
During an active session you see the list of exercises in the session (initially empty) and an "add exercise" button.
An exercise has a:
* Name - the user enters; this is a text field, but the app should try to auto-complete from the list of historically added pool of exercise names.
* Repetitions - number of repetitions
* Sets - number of sets
* Weight - this should be graphic as possible, as it's a complex type, either one of:
  * Body weight
  * Barbell - then you enter the bar weight (either 15kg or 20kg) and the weight per side (a slider in units of 2.5kg)
  * Dumbbell - either 1 or 2, slider in units of 2.5 from 4kg to 25kg.
  * Kettlebell - either 12, 16, 20, 24, or 28.
* Total - should be calculated shown (not editable) - for barbell for instance it's bar weight + 2 * side.

From this you can either finish the exercise or duplicate it.

At any point you can end the session.

Add the functionality to export this data by email or load it from a file on the local filesystem.
