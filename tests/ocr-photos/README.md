# Phone OCR QA samples

The six original workout-board photos were provided by the user for public test cases.

In the app: **Start a session → 📷 Photo → Try a sample photo (QA)**.
Tap Photo 1–6 to preview an image. Drag the four corners to select a rectangular section, then tap **OCR** to append its detected names to the textbox. Repeat for other sections or photos, edit the text, then tap **Add exercises** to import the complete list. Names are converted to title case and numbers are removed.

These intentionally include glare, reflections, perspective, multiple columns, headings and exercise notes. OCR may include headings or misread names; the review step lets you correct them. Samples contain no prefilled OCR answers.

Browser regression test: install Playwright and Chrome, then run `node tests/photo-import.cjs`. The test needs network access for the OCR engine. Set `PLAYWRIGHT_MODULE` when using a bundled Playwright installation.
