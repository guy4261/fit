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
          .slice(0, 60)
          .toLowerCase()
          .replace(/(^|\s)(\p{L})/gu, (_, space, letter) => space + letter.toUpperCase()),
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
      <p>Choose a photo, adjust the four corners, then tap OCR. Scan more sections to build your list before adding exercises.</p>
      <div class="form-actions"><button type="button" class="secondary" data-camera>Take photo</button><button type="button" class="secondary" data-photos>Choose photo</button></div>
      <input data-camera-input type="file" accept="image/*" capture="environment" hidden>
      <input data-photos-input type="file" accept="image/*" hidden>
      <details class="photo-samples"><summary>Try a sample photo (QA)</summary><p>Select a photo to run the same OCR used for your own images.</p><div class="photo-sample-grid">${Array.from({ length: 6 }, (_, i) => `<button class="secondary photo-sample" type="button" data-sample="${i + 1}"><img src="tests/ocr-photos/photo-${i + 1}.jpg" alt="Workout board sample ${i + 1}" loading="lazy"><span>Photo ${i + 1}</span></button>`).join('')}</div></details>
      <div data-preview hidden><p>Drag the corners to select a rectangular section.</p><div class="photo-crop"><img data-image alt="Photo to crop"><div class="photo-crop-selection">${['tl', 'tr', 'br', 'bl'].map((corner, i) => `<button type="button" class="photo-crop-corner" data-corner="${corner}" aria-label="Adjust ${['top left', 'top right', 'bottom right', 'bottom left'][i]} crop corner"></button>`).join('')}</div></div><button type="button" class="primary photo-ocr" data-ocr disabled>OCR</button></div>
      <p data-status role="status" aria-live="polite">English text recognition. The first scan needs internet access.</p>
      <div class="field" data-review><label for="photo-exercise-names">Exercise names (one per line)</label><textarea id="photo-exercise-names" class="text-input" rows="8"></textarea></div>
      <div class="form-actions"><button class="secondary" type="button" data-close>Cancel</button><button class="primary" type="button" data-add disabled>Add exercises</button></div>`;
      document.body.append(dialog);
      const query = (selector) => dialog.querySelector(selector);
      const status = query('[data-status]');
      const output = query('textarea');
      const add = query('[data-add]');
      const image = query('[data-image]');
      const cropView = query('.photo-crop');
      const selection = query('.photo-crop-selection');
      const ocr = query('[data-ocr]');
      let imageUrl = null,
        ready = false;
      let crop = { left: 0, top: 0, right: 1, bottom: 1 };
      let worker,
        closed = false,
        busy = false;
      const updateAdd = () => {
        add.disabled = busy || !namesFromText(output.value).length;
        ocr.disabled = busy || !ready;
        for (const button of dialog.querySelectorAll(
          '[data-camera], [data-photos], [data-sample], [data-corner]',
        ))
          button.disabled = busy;
      };
      const renderCrop = () => {
        selection.style.left = `${crop.left * 100}%`;
        selection.style.top = `${crop.top * 100}%`;
        selection.style.width = `${(crop.right - crop.left) * 100}%`;
        selection.style.height = `${(crop.bottom - crop.top) * 100}%`;
      };
      const moveCorner = (corner, x, y) => {
        if (busy) return;
        const minX = Math.min(1, 16 / image.naturalWidth);
        const minY = Math.min(1, 16 / image.naturalHeight);
        if (corner.endsWith('l')) crop.left = Math.max(0, Math.min(crop.right - minX, x));
        else crop.right = Math.min(1, Math.max(crop.left + minX, x));
        if (corner.startsWith('t'))
          crop.top = Math.max(0, Math.min(crop.bottom - minY, y));
        else crop.bottom = Math.min(1, Math.max(crop.top + minY, y));
        renderCrop();
      };
      for (const handle of dialog.querySelectorAll('[data-corner]')) {
        handle.onpointerdown = (event) => {
          if (busy) return;
          event.preventDefault();
          handle.setPointerCapture(event.pointerId);
        };
        handle.onpointermove = (event) => {
          if (!handle.hasPointerCapture(event.pointerId)) return;
          const rect = cropView.getBoundingClientRect();
          moveCorner(
            handle.dataset.corner,
            (event.clientX - rect.left) / rect.width,
            (event.clientY - rect.top) / rect.height,
          );
        };
        handle.onkeydown = (event) => {
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key))
            return;
          event.preventDefault();
          const corner = handle.dataset.corner;
          const step = event.shiftKey ? 0.05 : 0.01;
          moveCorner(
            corner,
            crop[corner.endsWith('l') ? 'left' : 'right'] +
              (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0),
            crop[corner.startsWith('t') ? 'top' : 'bottom'] +
              (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0),
          );
        };
      }
      query('[data-close]').onclick = () => dialog.close();
      dialog.addEventListener(
        'close',
        () => {
          closed = true;
          if (worker) void worker.terminate().catch(() => {});
          if (imageUrl) URL.revokeObjectURL(imageUrl);
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
      const selectPhoto = (file) => {
        if (!file || busy) return;
        ready = false;
        query('[data-preview]').hidden = true;
        if (imageUrl) URL.revokeObjectURL(imageUrl);
        imageUrl = typeof file === 'string' ? null : URL.createObjectURL(file);
        image.onload = () => {
          if (closed) return;
          ready = true;
          crop = { left: 0, top: 0, right: 1, bottom: 1 };
          renderCrop();
          query('[data-preview]').hidden = false;
          status.textContent =
            'Adjust the corners, then tap OCR to append this section to your list.';
          updateAdd();
        };
        image.onerror = () => {
          ready = false;
          status.textContent = 'Could not open this photo. Try another image.';
          updateAdd();
        };
        image.src = imageUrl || file;
        status.textContent = 'Opening photo…';
        updateAdd();
      };
      const scan = async () => {
        if (!ready || busy) return;
        const canvas = document.createElement('canvas');
        const left = Math.floor(crop.left * image.naturalWidth);
        const top = Math.floor(crop.top * image.naturalHeight);
        canvas.width = Math.max(1, Math.round(crop.right * image.naturalWidth) - left);
        canvas.height = Math.max(1, Math.round(crop.bottom * image.naturalHeight) - top);
        canvas
          .getContext('2d')
          .drawImage(
            image,
            left,
            top,
            canvas.width,
            canvas.height,
            0,
            0,
            canvas.width,
            canvas.height,
          );
        busy = true;
        updateAdd();
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
          const result = await worker.recognize(canvas);
          if (closed) return;
          const names = namesFromText(result.data.text);
          if (names.length)
            output.value = [output.value.trimEnd(), names.join('\n')]
              .filter(Boolean)
              .join('\n');
          status.textContent = names.length
            ? `Appended ${names.length} names. Scan another section, edit the list, or tap Add exercises.`
            : 'No names found in this section. Adjust the corners and try again.';
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
            updateAdd();
          }
        }
      };
      ocr.onclick = () => void scan();
      for (const source of ['camera', 'photos']) {
        const input = query(`[data-${source}-input]`);
        query(`[data-${source}]`).onclick = () => input.click();
        input.onchange = () => {
          const file = input.files[0];
          input.value = '';
          selectPhoto(file);
        };
      }
      for (const button of dialog.querySelectorAll('[data-sample]')) {
        button.onclick = () => {
          query('.photo-samples').open = false;
          selectPhoto(
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
