/* Photo import stays in the browser; the OCR engine loads only when needed. */
(() => {
  let enginePromise;
  function loadEngine() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (!enginePromise)
      enginePromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src =
          'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
        script.onload = () => resolve(window.Tesseract);
        script.onerror = () => {
          script.remove();
          enginePromise = null;
          reject(
            new Error(
              'Could not load OCR. Check your internet connection and try again.',
            ),
          );
        };
        document.head.append(script);
      });
    return enginePromise;
  }

  function namesFromText(text) {
    const names = text
      .split(/\r?\n/)
      .map((line) =>
        line
          .replace(/\p{N}+/gu, ' ')
          .replace(/[^\p{L}\p{M}\s'-]/gu, ' ')
          .replace(/\s+/g, ' ')
          .replace(/^[\s'-]+|[\s'-]+$/g, '')
          .trim()
          .slice(0, 60),
      )
      .filter((name) => /\p{L}/u.test(name));
    return [...new Map(names.map((name) => [name.toLocaleLowerCase(), name])).values()];
  }

  window.ExercisePhoto = {
    namesFromText,
    open(onImport) {
      const dialog = document.createElement('dialog');
      dialog.className = 'data-dialog';
      dialog.innerHTML = `<div class="dialog-head"><h2>Exercises from a photo</h2></div>
      <p>Photograph an exercise list or choose an image. Review the detected names before adding them.</p>
      <div class="form-actions"><button type="button" class="secondary" data-camera>Take photo</button><button type="button" class="secondary" data-photos>Choose photo</button></div>
      <input data-camera-input type="file" accept="image/*" capture="environment" hidden>
      <input data-photos-input type="file" accept="image/*" hidden>
      <details class="photo-samples"><summary>Try a sample photo (QA)</summary><p>Select a photo to run the same OCR used for your own images.</p><div class="photo-sample-grid">${Array.from({ length: 6 }, (_, i) => `<button class="secondary photo-sample" type="button" data-sample="${i + 1}"><img src="tests/ocr-photos/photo-${i + 1}.jpg" alt="Workout board sample ${i + 1}" loading="lazy"><span>Photo ${i + 1}</span></button>`).join('')}</div></details>
      <p data-status role="status" aria-live="polite">English text recognition. The first scan needs internet access.</p>
      <div class="field" data-review hidden><label for="photo-exercise-names">Exercise names (one per line)</label><textarea id="photo-exercise-names" class="text-input" rows="8"></textarea></div>
      <div class="form-actions"><button class="secondary" type="button" data-close>Cancel</button><button class="primary" type="button" data-add disabled>Add exercises</button></div>`;
      document.body.append(dialog);
      const query = (selector) => dialog.querySelector(selector);
      const status = query('[data-status]');
      const output = query('textarea');
      const add = query('[data-add]');
      let worker,
        closed = false,
        busy = false;
      const updateAdd = () => {
        add.disabled = busy || !namesFromText(output.value).length;
      };
      query('[data-close]').onclick = () => dialog.close();
      dialog.addEventListener(
        'close',
        () => {
          closed = true;
          if (worker) void worker.terminate().catch(() => {});
          dialog.remove();
        },
        { once: true },
      );
      output.oninput = updateAdd;
      add.onclick = () => {
        const names = namesFromText(output.value);
        if (!busy && names.length) {
          onImport(names);
          dialog.close();
        }
      };
      const scan = async (file) => {
        if (!file || busy) return;
        busy = true;
        output.value = '';
        query('[data-review]').hidden = true;
        updateAdd();
        for (const button of dialog.querySelectorAll(
          '[data-camera], [data-photos], [data-sample]',
        ))
          button.disabled = true;
        status.textContent = 'Loading text recognition…';
        try {
          const engine = await loadEngine();
          if (closed) return;
          worker = await engine.createWorker('eng', 1, {
            logger(message) {
              if (!closed && message.status)
                status.textContent = `${message.status}${typeof message.progress === 'number' ? ` (${Math.round(message.progress * 100)}%)` : ''}…`;
            },
          });
          if (closed) return;
          const result = await worker.recognize(file);
          if (closed) return;
          const names = namesFromText(result.data.text);
          output.value = names.join('\n');
          query('[data-review]').hidden = !names.length;
          status.textContent = names.length
            ? `Found ${names.length} names. Numbers removed; edit or delete any unwanted lines.`
            : 'No exercise names found. Try a clearer photo.';
        } catch (error) {
          if (!closed)
            status.textContent = `Could not read this photo. ${error.message || 'Try a different image.'}`;
        } finally {
          if (worker) {
            await worker.terminate().catch(() => {});
            worker = null;
          }
          busy = false;
          if (!closed) {
            for (const button of dialog.querySelectorAll(
              '[data-camera], [data-photos], [data-sample]',
            ))
              button.disabled = false;
            updateAdd();
          }
        }
      };
      for (const source of ['camera', 'photos']) {
        const input = query(`[data-${source}-input]`);
        query(`[data-${source}]`).onclick = () => input.click();
        input.onchange = () => {
          const file = input.files[0];
          input.value = '';
          void scan(file);
        };
      }
      for (const button of dialog.querySelectorAll('[data-sample]')) {
        button.onclick = () => {
          query('.photo-samples').open = false;
          void scan(
            new URL(
              `tests/ocr-photos/photo-${button.dataset.sample}.jpg`,
              document.baseURI,
            ).href,
          );
        };
      }
      dialog.showModal();
    },
  };
})();
