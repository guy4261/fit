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
    openLive(onImport) {
      const dialog = document.createElement('dialog');
      dialog.className = 'data-dialog live-scan-dialog';
      dialog.innerHTML = `<div class="dialog-head live-scan-heading"><h2>Review exercises</h2></div>
        <div data-live-preview class="live-scan-preview"><video autoplay muted playsinline aria-label="Live rear camera preview"></video><div class="live-scan-guide" aria-hidden="true"></div></div>
        <section class="live-scan-results" data-live-results hidden aria-label="Detected exercises"><div class="live-scan-results-head"><strong data-results-title></strong><button class="secondary" data-clear-all type="button">Clear All</button></div><ul data-detected-names></ul><p data-detected-empty hidden></p><details data-raw-results hidden><summary>Raw detected text</summary><pre data-detected-text></pre></details></section>
        <p data-live-status role="status" aria-live="polite">Opening camera… Allow camera access when asked.</p>
        <div class="form-actions live-scan-controls"><button class="primary" data-read disabled>Take a scan</button><button class="secondary" data-review>Done</button></div>
        <div data-live-review hidden><p>Edit names or remove unwanted headings. No sets will be added.</p><button class="secondary" data-clear-all type="button">Clear All</button><div data-live-names class="photo-exercise-names"></div><div class="form-actions"><button class="secondary" data-resume>Scan more</button><button class="primary" data-import disabled>Add exercises</button></div></div>
        <div class="form-actions live-scan-cancel"><button class="secondary" data-cancel>Cancel</button></div>`;
      document.body.append(dialog);
      const query = (selector) => dialog.querySelector(selector);
      const video = query('video');
      const status = query('[data-live-status]');
      const read = query('[data-read]');
      const review = query('[data-review]');
      const list = query('[data-live-names]');
      let stream,
        worker,
        workerPromise,
        closed = false,
        busy = false,
        reviewing = false,
        cameraFailed = false,
        pendingNames = null;
      const names = () =>
        namesFromText(
          [...list.querySelectorAll('input')].map((input) => input.value).join('\n'),
        );
      const update = () => {
        const savedNames = names();
        const count = savedNames.length;
        const known = new Set(savedNames.map((name) => name.toLowerCase()));
        const freshNames = pendingNames?.filter((name) => !known.has(name.toLowerCase()));
        read.disabled =
          closed ||
          busy ||
          reviewing ||
          (pendingNames !== null
            ? !freshNames.length
            : !cameraFailed && (!stream || !video.videoWidth || video.readyState < 2));
        read.textContent = busy
          ? 'Reading…'
          : pendingNames !== null
            ? `Add results (${freshNames.length})`
            : cameraFailed
              ? 'Retry camera'
              : 'Take a scan';
        review.disabled = busy;
        review.textContent =
          pendingNames !== null ? (cameraFailed ? 'Retry camera' : 'Retry') : 'Done';
        query('[data-import]').disabled = busy || !count;
        for (const button of dialog.querySelectorAll('[data-clear-all]'))
          button.disabled = busy || (!count && pendingNames === null);
        const showResults = !reviewing && (pendingNames !== null || count > 0);
        query('[data-live-results]').hidden = !showResults;
        dialog.classList.toggle('has-results', showResults);
        query('[data-results-title]').textContent =
          pendingNames !== null ? 'This scan' : `${count} saved exercises`;
        const detectedList = query('[data-detected-names]');
        detectedList.replaceChildren();
        for (const name of pendingNames ?? savedNames) {
          const item = document.createElement('li');
          item.textContent = name;
          if (pendingNames !== null && known.has(name.toLowerCase())) {
            const duplicate = document.createElement('small');
            duplicate.textContent = 'Already added';
            item.append(duplicate);
          }
          detectedList.append(item);
        }
        query('[data-detected-empty]').hidden =
          pendingNames === null || pendingNames.length > 0;
        query('[data-detected-empty]').textContent =
          'No exercise names found. Move closer or avoid reflections, then retry.';
        query('[data-raw-results]').hidden = pendingNames === null;
      };
      const stopCamera = () => {
        if (stream) stream.getTracks().forEach((track) => track.stop());
        stream = null;
        video.srcObject = null;
      };
      const cleanup = () => {
        if (closed) return;
        closed = true;
        stopCamera();
        if (worker) void worker.terminate().catch(() => {});
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('pagehide', onPageHide);
        previewObserver.disconnect();
        dialog.remove();
      };
      const onPageHide = () => dialog.close();
      const onVisibility = () => {
        if (document.hidden) {
          stopCamera();
          cameraFailed = true;
          status.textContent = 'Camera paused. Tap Retry camera when you return.';
          update();
        }
      };
      const startCamera = async () => {
        cameraFailed = false;
        update();
        status.textContent = 'Opening camera… Allow camera access when asked.';
        try {
          if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
            throw new Error(
              'Live scanning needs HTTPS or localhost. On iPhone, use an HTTPS address for the app on your computer. You can still use the Photo button.',
            );
          stopCamera();
          const acquired = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          });
          if (closed || document.hidden) {
            acquired.getTracks().forEach((track) => track.stop());
            return;
          }
          stream = acquired;
          video.srcObject = stream;
          stream.getVideoTracks()[0].onended = () => {
            stopCamera();
            cameraFailed = true;
            status.textContent = 'Camera stopped. Tap Retry camera.';
            update();
          };
          await video.play();
          if (closed) return;
          status.textContent =
            'Fit the text inside the frame and hold still. Scan the board, then move closer for missed sections. First scan needs internet.';
          update();
        } catch (error) {
          if (closed) return;
          stopCamera();
          cameraFailed = true;
          status.textContent =
            error.name === 'NotAllowedError'
              ? 'Camera access was denied. Allow it in Safari’s website settings and retry, or use Photo.'
              : `Could not open camera. ${error.message}`;
          update();
        }
      };
      video.addEventListener('loadeddata', update);
      // The guide follows the actual image, including letterboxing in landscape.
      const positionGuide = () => {
        if (!video.videoWidth) return;
        const preview = query('[data-live-preview]');
        const scale = Math.min(
          preview.clientWidth / video.videoWidth,
          preview.clientHeight / video.videoHeight,
        );
        const width = video.videoWidth * scale;
        const height = video.videoHeight * scale;
        Object.assign(query('.live-scan-guide').style, {
          left: `${(preview.clientWidth - width) / 2 + width * 0.05}px`,
          top: `${(preview.clientHeight - height) / 2 + height * 0.05}px`,
          width: `${width * 0.9}px`,
          height: `${height * 0.9}px`,
        });
      };
      const previewObserver = new ResizeObserver(positionGuide);
      previewObserver.observe(query('[data-live-preview]'));
      video.addEventListener('resize', positionGuide);
      video.addEventListener('loadedmetadata', positionGuide);
      const append = (name) => {
        const row = document.createElement('div');
        row.className = 'exercise-name-row';
        const input = document.createElement('input');
        input.className = 'text-input';
        input.value = name;
        input.maxLength = 60;
        input.setAttribute('aria-label', 'Exercise name');
        input.oninput = update;
        const remove = document.createElement('button');
        remove.className = 'name-lock-button photo-name-delete';
        remove.textContent = '×';
        remove.setAttribute('aria-label', `Remove ${name}`);
        remove.onclick = () => {
          row.remove();
          update();
        };
        row.append(input, remove);
        list.append(row);
      };
      const scanFrame = async () => {
        if (busy || closed) return;
        pendingNames = null;
        query('[data-raw-results]').open = false;
        if (cameraFailed) {
          void startCamera();
          return;
        }
        if (!stream || !video.videoWidth || video.readyState < 2) {
          status.textContent = 'Wait for the camera to be ready, then tap Take a scan.';
          update();
          return;
        }
        busy = true;
        update();
        status.textContent = 'Reading captured frame… You can point at the next section.';
        // Capture before awaiting the OCR engine; never encode frames as data URLs.
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(2, Math.round(video.videoWidth * 0.9));
        canvas.height = Math.max(2, Math.round(video.videoHeight * 0.9));
        try {
          canvas
            .getContext('2d')
            .drawImage(
              video,
              video.videoWidth * 0.05,
              video.videoHeight * 0.05,
              video.videoWidth * 0.9,
              video.videoHeight * 0.9,
              0,
              0,
              canvas.width,
              canvas.height,
            );
          if (!workerPromise)
            workerPromise = loadEngine().then((engine) => engine.createWorker('eng'));
          worker = await workerPromise;
          if (closed) {
            await worker.terminate();
            return;
          }
          const result = await worker.recognize(canvas);
          if (closed) return;
          pendingNames = namesFromText(result.data.text).filter(
            (name) =>
              !/^(?:[A-F] )?(?:EMOM|TABATA|STRENGTH FLOW|MIX|STRENGTH)\b/i.test(name),
          );
          query('[data-detected-text]').textContent = result.data.text;
          status.textContent =
            'Check the detected names below. Add results to keep them, or reposition the camera and Retry.';
        } catch (error) {
          if (!closed)
            status.textContent = `Could not read this frame. ${error.message || 'Try again.'}`;
          if (!worker) workerPromise = null;
        } finally {
          busy = false;
          if (!closed) update();
        }
      };
      read.onclick = () => {
        if (read.disabled) return;
        if (pendingNames !== null) {
          const known = new Set(names().map((name) => name.toLowerCase()));
          let added = 0;
          for (const name of pendingNames) {
            if (known.has(name.toLowerCase())) continue;
            append(name);
            known.add(name.toLowerCase());
            added++;
          }
          pendingNames = null;
          status.textContent = `Saved ${added} names · ${names().length} total. Take another scan or tap Done.`;
          update();
        } else void scanFrame();
      };
      review.onclick = () => {
        if (busy) return;
        if (pendingNames !== null) {
          void scanFrame();
          return;
        }
        if (!names().length) {
          dialog.close();
          return;
        }
        reviewing = true;
        dialog.classList.add('is-reviewing');
        query('[data-live-preview]').hidden = true;
        query('[data-live-review]').hidden = false;
        status.textContent = 'Review your list, then add exercises with no sets.';
        update();
      };
      query('[data-resume]').onclick = () => {
        reviewing = false;
        dialog.classList.remove('is-reviewing');
        query('[data-live-preview]').hidden = false;
        query('[data-live-review]').hidden = true;
        status.textContent = `Point at the next section and tap Take a scan · ${names().length} names saved.`;
        update();
      };
      query('[data-import]').onclick = () => {
        const result = names();
        if (busy || !result.length) return;
        onImport(result);
        dialog.close();
      };
      query('[data-cancel]').onclick = () => dialog.close();
      for (const button of dialog.querySelectorAll('[data-clear-all]')) {
        button.onclick = () => {
          if (busy) return;
          list.replaceChildren();
          pendingNames = null;
          query('[data-detected-text]').textContent = '';
          status.textContent =
            'All scan results cleared. Scan again to start a new list.';
          update();
        };
      }
      dialog.addEventListener('close', cleanup, { once: true });
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('pagehide', onPageHide);
      dialog.showModal();
      void startCamera();
    },
    open(onImport) {
      const dialog = document.createElement('dialog');
      dialog.className = 'data-dialog';
      dialog.innerHTML = `<div class="dialog-head"><h2>Exercises from a photo</h2></div>
      <p>Choose a photo, adjust the four corners, then tap OCR. Scan more sections to build your list before adding exercises.</p>
      <div class="form-actions"><button type="button" class="secondary" data-camera>Take photo</button><button type="button" class="secondary" data-photos>Choose photo</button></div>
      <input data-camera-input type="file" accept="image/*" capture="environment" hidden>
      <input data-photos-input type="file" accept="image/*" hidden>
      <details class="photo-samples"><summary>Try a sample photo (QA)</summary><p>Select a photo to run the same OCR used for your own images.</p><div class="photo-sample-grid">${Array.from({ length: 6 }, (_, i) => `<button class="secondary photo-sample" type="button" data-sample="${i + 1}"><img src="tests/ocr-photos/photo-${i + 1}.jpg" alt="Workout board sample ${i + 1}" loading="lazy"><span>Photo ${i + 1}</span></button>`).join('')}</div></details>
      <div data-preview hidden><p>Adjust each corner to match the text. Drag inside the outline to move the selection. With a mouse, scroll over the image to zoom and drag the zoomed image to pan; hold Shift while dragging to move the selection.</p><div class="photo-zoom-controls"><button type="button" class="secondary" data-zoom="out" aria-label="Zoom out">−</button><output data-zoom-level>100%</output><button type="button" class="secondary" data-zoom="in" aria-label="Zoom in">＋</button><button type="button" class="secondary" data-zoom="reset">Reset zoom</button></div><div class="photo-crop-viewport"><div class="photo-crop"><img data-image alt="Photo to crop"><svg class="photo-crop-selection" viewBox="0 0 1 1" preserveAspectRatio="none"><polygon data-selection></polygon></svg>${['tl', 'tr', 'br', 'bl'].map((corner, i) => `<button type="button" class="photo-crop-corner" data-corner="${corner}" aria-label="Adjust ${['top left', 'top right', 'bottom right', 'bottom left'][i]} crop corner"></button>`).join('')}</div></div><button type="button" class="primary photo-ocr" data-ocr disabled>OCR</button></div>
      <p data-status role="status" aria-live="polite">English text recognition. The first scan needs internet access.</p>
      <div class="field" data-review><span class="field-label" id="photo-names-label">Exercise names</span><p>Tap a name to edit it. Tap × to remove it.</p><div id="photo-exercise-names" class="photo-exercise-names" role="list" aria-labelledby="photo-names-label"></div></div>
      <div class="form-actions"><button class="secondary" type="button" data-close>Cancel</button><button class="primary" type="button" data-add disabled>Add exercises</button></div>`;
      document.body.append(dialog);
      const query = (selector) => dialog.querySelector(selector);
      const status = query('[data-status]');
      const output = query('#photo-exercise-names');
      const reviewedNames = () =>
        [...output.children]
          .map((row) => {
            const input = row.querySelector('input');
            return input ? input.value : row.querySelector('[data-name]').textContent;
          })
          .join('\n');
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
        add.disabled = busy || !namesFromText(reviewedNames()).length;
        ocr.disabled = busy || !ready;
        for (const button of dialog.querySelectorAll(
          '[data-camera], [data-photos], [data-sample], [data-corner], [data-zoom]',
        ))
          button.disabled = busy;
      };
      const appendName = (name) => {
        const row = document.createElement('div');
        row.className = 'exercise-name-row';
        row.setAttribute('role', 'listitem');
        const label = document.createElement('button');
        label.type = 'button';
        label.className = 'locked-exercise-name photo-exercise-name';
        label.dataset.name = '';
        label.textContent = name;
        label.setAttribute('aria-label', `Edit ${name}`);
        label.onclick = () => {
          const input = document.createElement('input');
          input.className = 'text-input';
          input.value = label.textContent;
          input.maxLength = 60;
          input.setAttribute('aria-label', 'Exercise name');
          const save = () => {
            if (!input.isConnected) return;
            const value = input.value.trim();
            if (!value) row.remove();
            else {
              label.textContent = value;
              label.setAttribute('aria-label', `Edit ${value}`);
              remove.setAttribute('aria-label', `Delete ${value}`);
              input.replaceWith(label);
            }
            updateAdd();
          };
          input.oninput = updateAdd;
          input.onblur = save;
          input.onkeydown = (event) => {
            if (event.key === 'Enter' || event.key === 'Escape') {
              event.preventDefault();
              if (event.key === 'Escape') input.value = label.textContent;
              save();
              if (label.isConnected) label.focus();
            }
          };
          label.replaceWith(input);
          input.focus();
          input.select();
        };
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'name-lock-button photo-name-delete';
        remove.textContent = '×';
        remove.setAttribute('aria-label', `Delete ${name}`);
        remove.onpointerdown = (event) => event.preventDefault();
        remove.onclick = () => {
          row.remove();
          updateAdd();
        };
        row.append(label, remove);
        output.append(row);
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
      const setZoom = (
        next,
        x = viewport.clientWidth / 2,
        y = viewport.clientHeight / 2,
        reset = false,
      ) => {
        const before = cropView.getBoundingClientRect();
        const view = viewport.getBoundingClientRect();
        const imageX = (view.left + viewport.clientLeft + x - before.left) / before.width;
        const imageY = (view.top + viewport.clientTop + y - before.top) / before.height;
        zoom = Math.max(0.5, Math.min(4, next));
        cropView.style.width = `${zoom * 100}%`;
        query('[data-zoom-level]').value = `${Math.round(zoom * 100)}%`;
        const after = cropView.getBoundingClientRect();
        viewport.scrollLeft = reset
          ? 0
          : viewport.scrollLeft +
            after.left +
            imageX * after.width -
            (view.left + viewport.clientLeft + x);
        viewport.scrollTop = reset
          ? 0
          : viewport.scrollTop +
            after.top +
            imageY * after.height -
            (view.top + viewport.clientTop + y);
        viewport.classList.toggle('is-zoomed', zoom > 1);
      };
      for (const button of dialog.querySelectorAll('[data-zoom]')) {
        button.onclick = () =>
          setZoom(
            button.dataset.zoom === 'reset'
              ? 1
              : zoom * (button.dataset.zoom === 'in' ? 1.25 : 0.8),
            undefined,
            undefined,
            button.dataset.zoom === 'reset',
          );
      }
      cropView.addEventListener(
        'wheel',
        (event) => {
          event.preventDefault();
          if (busy || !ready || !event.deltaY) return;
          const view = viewport.getBoundingClientRect();
          setZoom(
            zoom * (event.deltaY < 0 ? 1.25 : 0.8),
            event.clientX - view.left - viewport.clientLeft,
            event.clientY - view.top - viewport.clientTop,
          );
        },
        { passive: false },
      );
      let pan = null;
      viewport.addEventListener(
        'pointerdown',
        (event) => {
          if (
            busy ||
            zoom <= 1 ||
            event.pointerType !== 'mouse' ||
            event.button !== 0 ||
            event.shiftKey ||
            event.target.closest('[data-corner]')
          )
            return;
          event.preventDefault();
          event.stopPropagation();
          viewport.setPointerCapture(event.pointerId);
          pan = {
            x: event.clientX,
            y: event.clientY,
            left: viewport.scrollLeft,
            top: viewport.scrollTop,
          };
          viewport.classList.add('is-panning');
        },
        { capture: true },
      );
      viewport.addEventListener('pointermove', (event) => {
        if (!pan || !viewport.hasPointerCapture(event.pointerId)) return;
        viewport.scrollLeft = pan.left - (event.clientX - pan.x);
        viewport.scrollTop = pan.top - (event.clientY - pan.y);
      });
      const endPan = () => {
        pan = null;
        viewport.classList.remove('is-panning');
      };
      viewport.addEventListener('pointerup', endPan);
      viewport.addEventListener('pointercancel', endPan);
      viewport.addEventListener('lostpointercapture', endPan);
      image.ondragstart = (event) => event.preventDefault();
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
      add.onclick = () => {
        const names = namesFromText(reviewedNames());
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
          viewport.classList.remove('is-zoomed', 'is-panning');
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
          names.forEach(appendName);
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
