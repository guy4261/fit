# Phone OCR QA samples

The six original workout-board photos were provided by the user for public test cases.

In the app: **Start a session → Add exercise → 📷 → Try a sample photo (QA)**.
Tap Photo 1–6 to run each image through the same OCR and editable review flow as camera/library photos. Review the text, then tap **Add exercises** to import it.

These intentionally include glare, reflections, perspective, multiple columns, headings and exercise notes. OCR may include headings or misread names; the review step lets you correct them. Samples contain no prefilled OCR answers.

Browser regression test: install Playwright and Chrome, then run `node tests/photo-import.cjs`. The test needs network access for the OCR engine. Set `PLAYWRIGHT_MODULE` when using a bundled Playwright installation.
