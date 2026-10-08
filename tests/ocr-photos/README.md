# Phone OCR QA samples

The six original workout-board photos were provided by the user for public test cases.

In the app: **Start a session → 📷 Photo → Try a sample photo (QA)**.
Tap Photo 1–6 to preview an image. Independently drag the four corners to match a quadrilateral around the text, or drag inside the outline to move the entire selection. Zoom in/out for precise selection; **Reset zoom** returns to 100% without changing the selected area. On desktop, use the mousewheel over the image to zoom and drag a zoomed image to pan. Hold Shift while dragging inside the outline to move the crop selection. Tap **OCR** to straighten the selected area and append its detected names as individual labels. Repeat for other sections or photos, tap a name to edit it (Enter or clicking away saves; Escape cancels), remove faulty lines with ×, then tap **Add exercises** to import the complete list. Names are converted to title case and numbers are removed.

These intentionally include glare, reflections, perspective, multiple columns, headings and exercise notes. OCR may include headings or misread names; the review step lets you correct them. Samples contain no prefilled OCR answers.

Browser regression test: install Playwright and Chrome, then run `node tests/photo-import.cjs`. The test needs network access for the OCR engine. Set `PLAYWRIGHT_MODULE` when using a bundled Playwright installation.
