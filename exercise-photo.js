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

  // Map each destination pixel through a projective transform into the photo.
  // This straightens perspective instead of OCR-ing the quadrilateral's bounding box.
  function perspectiveCrop(source, corners) {
    const p = corners.map(({ x, y }) => ({
      x: x * source.naturalWidth,
      y: y * source.naturalHeight,
    }));
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    let width = (distance(p[0], p[1]) + distance(p[3], p[2])) / 2;
    let height = (distance(p[0], p[3]) + distance(p[1], p[2])) / 2;
    const scale = Math.min(1, 2400 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(2, Math.round(width * scale));
    canvas.height = Math.max(2, Math.round(height * scale));
    const input = document.createElement('canvas');
    input.width = source.naturalWidth;
    input.height = source.naturalHeight;
    const ctx = input.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, 0, 0);
    const pixels = ctx.getImageData(0, 0, input.width, input.height).data;
    const dx1 = p[1].x - p[2].x,
      dx2 = p[3].x - p[2].x;
    const dy1 = p[1].y - p[2].y,
      dy2 = p[3].y - p[2].y;
    const dx3 = p[0].x - p[1].x + p[2].x - p[3].x;
    const dy3 = p[0].y - p[1].y + p[2].y - p[3].y;
    const denominator = dx1 * dy2 - dx2 * dy1;
    const g = (dx3 * dy2 - dx2 * dy3) / denominator;
    const h = (dx1 * dy3 - dx3 * dy1) / denominator;
    const a = p[1].x - p[0].x + g * p[1].x;
    const b = p[3].x - p[0].x + h * p[3].x;
    const d = p[1].y - p[0].y + g * p[1].y;
    const e = p[3].y - p[0].y + h * p[3].y;
    const output = canvas.getContext('2d');
    const result = output.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++) {
      const v = (y + 0.5) / canvas.height;
      for (let x = 0; x < canvas.width; x++) {
        const u = (x + 0.5) / canvas.width;
        const divisor = g * u + h * v + 1;
        const sx = Math.max(
          0,
          Math.min(input.width - 1, (a * u + b * v + p[0].x) / divisor - 0.5),
        );
        const sy = Math.max(
          0,
          Math.min(input.height - 1, (d * u + e * v + p[0].y) / divisor - 0.5),
        );
        const x0 = Math.floor(sx),
          y0 = Math.floor(sy);
        const x1 = Math.min(input.width - 1, x0 + 1),
          y1 = Math.min(input.height - 1, y0 + 1);
        const fx = sx - x0,
          fy = sy - y0;
        const target = (y * canvas.width + x) * 4;
        for (let channel = 0; channel < 3; channel++) {
          const at = (px, py) => pixels[(py * input.width + px) * 4 + channel];
          result.data[target + channel] =
            (at(x0, y0) * (1 - fx) + at(x1, y0) * fx) * (1 - fy) +
            (at(x0, y1) * (1 - fx) + at(x1, y1) * fx) * fy;
        }
        result.data[target + 3] = 255;
      }
    }
    output.putImageData(result, 0, 0);
    return canvas;
  }

  window.ExercisePhoto = {
    namesFromText,
    perspectiveCrop,
    open(onImport) {
      const dialog = document.createElement('dialog');
      dialog.className = 'data-dialog';
      dialog.innerHTML = `<div class="dialog-head"><h2>Exercises from a photo</h2></div>
      <p>Choose a photo, adjust the four corners, then tap OCR. Scan more sections to build your list before adding exercises.</p>
      <div class="form-actions"><button type="button" class="secondary" data-camera>Take photo</button><button type="button" class="secondary" data-photos>Choose photo</button></div>
      <input data-camera-input type="file" accept="image/*" capture="environment" hidden>
      <input data-photos-input type="file" accept="image/*" hidden>
      <details class="photo-samples"><summary>Try a sample photo (QA)</summary><p>Select a photo to run the same OCR used for your own images.</p><div class="photo-sample-grid">${Array.from({ length: 6 }, (_, i) => `<button class="secondary photo-sample" type="button" data-sample="${i + 1}"><img src="tests/ocr-photos/photo-${i + 1}.jpg" alt="Workout board sample ${i + 1}" loading="lazy"><span>Photo ${i + 1}</span></button>`).join('')}</div></details>
      <div data-preview hidden><p>Adjust each corner to match the text. Drag inside the outline to move the selection; scroll outside it to pan the zoomed photo.</p><div class="photo-zoom-controls"><button type="button" class="secondary" data-zoom="out" aria-label="Zoom out">−</button><output data-zoom-level>100%</output><button type="button" class="secondary" data-zoom="in" aria-label="Zoom in">＋</button><button type="button" class="secondary" data-zoom="reset">Reset zoom</button></div><div class="photo-crop-viewport"><div class="photo-crop"><img data-image alt="Photo to crop"><svg class="photo-crop-selection" viewBox="0 0 1 1" preserveAspectRatio="none"><polygon data-selection></polygon></svg>${['tl', 'tr', 'br', 'bl'].map((corner, i) => `<button type="button" class="photo-crop-corner" data-corner="${corner}" aria-label="Adjust ${['top left', 'top right', 'bottom right', 'bottom left'][i]} crop corner"></button>`).join('')}</div></div><button type="button" class="primary photo-ocr" data-ocr disabled>OCR</button></div>
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
      const selection = query('[data-selection]');
      const viewport = query('.photo-crop-viewport');
      const ocr = query('[data-ocr]');
      let imageUrl = null,
        ready = false;
      const fullCrop = () => [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ];
      const handles = [...dialog.querySelectorAll('[data-corner]')];
      let crop = fullCrop(),
        zoom = 1;
      let worker,
        closed = false,
        busy = false;
      const updateAdd = () => {
        add.disabled = busy || !namesFromText(output.value).length;
        ocr.disabled = busy || !ready;
        for (const button of dialog.querySelectorAll(
          '[data-camera], [data-photos], [data-sample], [data-corner], [data-zoom]',
        ))
          button.disabled = busy;
      };
      const renderCrop = () => {
        selection.setAttribute('points', crop.map((p) => `${p.x},${p.y}`).join(' '));
        handles.forEach((handle, index) => {
          handle.style.left = `${crop[index].x * 100}%`;
          handle.style.top = `${crop[index].y * 100}%`;
        });
      };
      const moveCorner = (index, x, y) => {
        if (busy) return;
        const next = crop.map((p) => ({ ...p }));
        next[index] = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
        // Reject crossed or collapsed corners so the perspective transform remains valid.
        if (
          !next.every((p, i) => {
            const q = next[(i + 1) % 4],
              r = next[(i + 2) % 4];
            return (q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x) > 0.00001;
          })
        )
          return;
        crop = next;
        renderCrop();
      };
      for (const [index, handle] of handles.entries()) {
        handle.onpointerdown = (event) => {
          if (busy) return;
          event.preventDefault();
          handle.setPointerCapture(event.pointerId);
        };
        handle.onpointermove = (event) => {
          if (!handle.hasPointerCapture(event.pointerId)) return;
          const rect = cropView.getBoundingClientRect();
          moveCorner(
            index,
            (event.clientX - rect.left) / rect.width,
            (event.clientY - rect.top) / rect.height,
          );
        };
        handle.onkeydown = (event) => {
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key))
            return;
          event.preventDefault();
          const step = event.shiftKey ? 0.05 : 0.01;
          moveCorner(
            index,
            crop[index].x +
              (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0),
            crop[index].y +
              (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0),
          );
        };
      }
      let drag = null;
      selection.onpointerdown = (event) => {
        if (busy) return;
        event.preventDefault();
        selection.setPointerCapture(event.pointerId);
        drag = {
          x: event.clientX,
          y: event.clientY,
          points: crop.map((p) => ({ ...p })),
        };
      };
      selection.onpointermove = (event) => {
        if (busy || !drag || !selection.hasPointerCapture(event.pointerId)) return;
        const rect = cropView.getBoundingClientRect();
        const dx = Math.max(
          -Math.min(...drag.points.map((p) => p.x)),
          Math.min(
            1 - Math.max(...drag.points.map((p) => p.x)),
            (event.clientX - drag.x) / rect.width,
          ),
        );
        const dy = Math.max(
          -Math.min(...drag.points.map((p) => p.y)),
          Math.min(
            1 - Math.max(...drag.points.map((p) => p.y)),
            (event.clientY - drag.y) / rect.height,
          ),
        );
        crop = drag.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        renderCrop();
      };
      selection.onpointerup = selection.onpointercancel = () => {
        drag = null;
      };
      for (const button of dialog.querySelectorAll('[data-zoom]')) {
        button.onclick = () => {
          const centerX =
            (viewport.scrollLeft + viewport.clientWidth / 2) / cropView.offsetWidth;
          const centerY =
            (viewport.scrollTop + viewport.clientHeight / 2) / cropView.offsetHeight;
          zoom =
            button.dataset.zoom === 'reset'
              ? 1
              : Math.max(
                  0.5,
                  Math.min(4, zoom * (button.dataset.zoom === 'in' ? 1.25 : 0.8)),
                );
          cropView.style.width = `${zoom * 100}%`;
          query('[data-zoom-level]').value = `${Math.round(zoom * 100)}%`;
          viewport.scrollLeft =
            button.dataset.zoom === 'reset'
              ? 0
              : centerX * cropView.offsetWidth - viewport.clientWidth / 2;
          viewport.scrollTop =
            button.dataset.zoom === 'reset'
              ? 0
              : centerY * cropView.offsetHeight - viewport.clientHeight / 2;
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
          crop = fullCrop();
          zoom = 1;
          cropView.style.width = '100%';
          query('[data-zoom-level]').value = '100%';
          viewport.scrollLeft = viewport.scrollTop = 0;
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
        const canvas = perspectiveCrop(image, crop);
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
