(() => {
  const KEY = 'form-training-log-v1',
    $ = (q, r = document) => r.querySelector(q),
    app = $('#app');
  let data = read(),
    active = null;
  function read() {
    try {
      let d = JSON.parse(localStorage.getItem(KEY) || '{}');
      return {
        sessions: Array.isArray(d.sessions) ? d.sessions : [],
        names: Array.isArray(d.names) ? d.names : [],
      };
    } catch {
      return { sessions: [], names: [] };
    }
  }
  function save() {
    localStorage.setItem(KEY, JSON.stringify(data));
  }
  function esc(x) {
    return String(x ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  }
  function total(w) {
    return w.type === 'barbell'
      ? w.bar + 2 * w.side
      : w.type === 'dumbbell'
        ? w.count * w.each
        : w.type === 'kettlebell'
          ? w.kg
          : 0;
  }
  function loadText(w) {
    return w.type === 'body'
      ? 'Body weight'
      : `${w.type === 'dumbbell' && w.count === 2 ? '2 × ' : ''}${total(w)} kg`;
  }
  function sessionTitle(date) {
    return new Date(date).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }
  function renderHome() {
    const ss = [...data.sessions].sort((a, b) => new Date(b.date) - new Date(a.date));
    app.innerHTML = `<div class="eyebrow">YOUR TRAINING, YOUR WAY</div><section class="hero"><div><h1>Show up.<br>Get stronger.</h1><p>A quiet place to keep track of your work.</p></div><button class="primary" id="start">＋ &nbsp;Start a session</button></section><div class="section-title"><h2>Training history</h2><span>${ss.length} ${ss.length === 1 ? 'session' : 'sessions'}</span></div>${
      ss.length
        ? `<div class="session-list">${ss
            .map((s) => {
              let d = new Date(s.date);
              return `<a href="#session/${encodeURIComponent(s.id)}" class="session-row"><span class="session-date"><b>${d.getDate()}</b><small>${d.toLocaleString(undefined, { month: 'short' })}</small></span><span class="session-info"><b>${esc(s.title)}</b><small>${s.exercises.length} exercises · ${s.exercises.reduce((n, e) => n + e.sets, 0)} total sets</small></span><span class="arrow">›</span></a>`;
            })
            .join('')}</div>`
        : `<div class="empty"><div class="empty-icon">🏋️</div><b>Your first session starts here</b>Your training history will show up after you finish a session.</div>`
    }`;
    $('#start').onclick = () => {
      startSession();
    };
  }
  function startSession() {
    const date = new Date().toISOString();
    active = {
      id: crypto.randomUUID?.() || String(Date.now()),
      date,
      title: sessionTitle(date),
      exercises: [],
    };
    renderActive();
  }
  function renderActive() {
    app.innerHTML = `<div class="session-head"><button class="back" id="back">‹</button><div><h1>${esc(active.title)}</h1><p>${active.exercises.length} exercises</p></div><button class="secondary session-actions" id="finish">Finish</button></div><div class="section-title"><h2>Exercises</h2><span class="exercise-count-controls"><span>${active.exercises.length} added</span><button class="rotate-action" id="rotate-exercises" type="button" aria-label="Move last exercise to the top" title="Move last exercise to the top" ${active.exercises.length < 2 ? 'disabled' : ''}>↻</button></span></div><div class="exercise-list">${active.exercises.map((e, i) => `<article class="exercise-card"><div class="exercise-card-head"><div style="flex:1"><h3>${esc(e.name)}</h3><p class="details">${e.sets} sets × ${e.reps} reps</p></div><span class="load-pill">${esc(loadText(e.weight))}</span></div><div class="card-controls"><button class="small-action" data-edit="${i}">Edit</button><button class="small-action" data-copy="${i}">Duplicate</button><button class="small-action delete" data-remove="${i}">Remove</button></div></article>`).join('')}</div><button class="add-exercise" id="add"><span>＋</span> Add exercise</button>${active.exercises.length ? '<div class="finish-bar"><button class="primary" id="finish-bottom">Finish session &nbsp; →</button></div>' : ''}`;
    $('#back').onclick = () => {
      if (
        !active.exercises.length ||
        confirm('Leave this session? It has not been saved.')
      ) {
        active = null;
        location.hash = '#home';
        renderHome();
      }
    };
    $('#add').onclick = () => exerciseForm();
    $('#rotate-exercises').onclick = () => {
      if (active.exercises.length < 2) return;
      active.exercises.unshift(active.exercises.pop());
      renderActive();
    };
    $('#finish').onclick = finish;
    $('#finish-bottom')?.addEventListener('click', finish);
    app
      .querySelectorAll('[data-edit]')
      .forEach((b) => (b.onclick = () => exerciseForm(+b.dataset.edit)));
    app.querySelectorAll('[data-copy]').forEach(
      (b) =>
        (b.onclick = () => {
          active.exercises.splice(
            +b.dataset.copy + 1,
            0,
            structuredClone(active.exercises[+b.dataset.copy]),
          );
          renderActive();
        }),
    );
    app.querySelectorAll('[data-remove]').forEach(
      (b) =>
        (b.onclick = () => {
          active.exercises.splice(+b.dataset.remove, 1);
          renderActive();
        }),
    );
  }
  function exerciseForm(index = null) {
    let ex =
      index === null
        ? { name: '', sets: 3, reps: 10, weight: { type: 'body' } }
        : structuredClone(active.exercises[index]);
    app.innerHTML = `<div class="session-head"><button class="back" id="form-back">‹</button><div><h1>${index === null ? 'Add exercise' : 'Edit exercise'}</h1><p>Build your session one movement at a time</p></div></div><form class="form-card" id="form"><div class="field"><label for="name">Exercise name</label><input id="name" class="text-input" list="exercise-suggestions" value="${esc(ex.name)}" placeholder="e.g. Goblet squat" required maxlength="60" autocomplete="off"></div><div class="split-fields"><div class="field"><label for="sets">Sets</label><input class="number-input" id="sets" type="number" min="1" max="99" value="${ex.sets}" required></div><div class="field"><label for="reps">Repetitions</label><input class="number-input" id="reps" type="number" min="1" max="999" value="${ex.reps}" required></div></div><div class="field"><span class="field-label">Load type</span><div class="weight-types">${[
      ['body', 'Body'],
      ['barbell', 'Barbell'],
      ['dumbbell', 'Dumbbell'],
      ['kettlebell', 'Kettlebell'],
    ]
      .map(
        ([v, l]) =>
          `<label class="weight-option"><input type="radio" name="type" value="${v}" ${ex.weight.type === v ? 'checked' : ''}><span>${l}</span></label>`,
      )
      .join(
        '',
      )}</div><div id="weight-panel" class="weight-panel"></div></div><div class="form-actions"><button type="button" class="secondary" id="cancel">Cancel</button><button class="primary">${index === null ? 'Add exercise' : 'Save changes'}</button></div></form>`;
    const form = $('#form');
    $('#form-back').onclick = renderActive;
    $('#cancel').onclick = renderActive;
    function panel() {
      let t = $('input[name=type]:checked', form).value,
        w = ex.weight,
        p = $('#weight-panel');
      if (t === 'body') {
        p.innerHTML =
          '<div class="total-box" style="border:0;margin:0;padding:0"><span>No external load</span><b>Body</b></div>';
        return;
      }
      if (t === 'barbell') {
        let bar = w.type === 'barbell' ? w.bar : 20,
          side = w.type === 'barbell' ? w.side : 10;
        p.innerHTML = `<div class="weight-row"><span class="weight-row-label">Bar weight</span><div class="choice-toggle" role="group" aria-label="Bar weight"><button type="button" data-bar="15" aria-pressed="${bar === 15}">15 kg</button><button type="button" data-bar="20" aria-pressed="${bar === 20}">20 kg</button></div></div><div class="weight-row"><label for="side">Per side</label><input id="side" type="range" min="0" max="100" step="2.5" value="${side}"><output id="side-val" class="range-value">${side} kg</output></div><div class="total-box"><span>Total barbell weight</span><b id="total">${bar + side * 2} kg</b></div>`;
        let up = () => {
          $('#side-val').value = $('#side').value + ' kg';
          $('#total').textContent =
            +$('.choice-toggle [aria-pressed="true"]').dataset.bar +
            2 * +$('#side').value +
            ' kg';
        };
        p.querySelectorAll('[data-bar]').forEach((button) => {
          button.onclick = () => {
            p.querySelectorAll('[data-bar]').forEach((option) =>
              option.setAttribute('aria-pressed', option === button),
            );
            up();
          };
        });
        $('#side').oninput = up;
      } else if (t === 'dumbbell') {
        let count = w.type === 'dumbbell' ? w.count : 2,
          each = w.type === 'dumbbell' ? w.each : 10;
        p.innerHTML = `<div class="weight-row"><span class="weight-row-label">Dumbbells</span><div class="choice-toggle" role="group" aria-label="Number of dumbbells"><button type="button" data-count="1" aria-pressed="${count === 1}">1</button><button type="button" data-count="2" aria-pressed="${count === 2}">2</button></div></div><div class="weight-row"><label for="each">Each</label><input id="each" type="range" min="4" max="25" step="2.5" value="${each}"><output id="each-val" class="range-value">${each} kg</output></div><div class="total-box"><span>Total weight</span><b id="total">${count * each} kg</b></div>`;
        let up = () => {
          $('#each-val').value = $('#each').value + ' kg';
          $('#total').textContent =
            +$('.choice-toggle [aria-pressed="true"]').dataset.count * +$('#each').value +
            ' kg';
        };
        p.querySelectorAll('[data-count]').forEach((button) => {
          button.onclick = () => {
            p.querySelectorAll('[data-count]').forEach((option) =>
              option.setAttribute('aria-pressed', option === button),
            );
            up();
          };
        });
        $('#each').oninput = up;
      } else {
        let kg = w.type === 'kettlebell' ? w.kg : 16;
        p.innerHTML = `<div class="kettlebell-options" role="group" aria-label="Kettlebell weight">${[12, 16, 20, 24, 28].map((n) => `<button class="kettlebell-option" type="button" data-kg="${n}" aria-label="${n} kilograms" aria-pressed="${n === kg}">${n}</button>`).join('')}</div><div class="total-box"><span>Total kettlebell weight</span><b id="total">${kg} kg</b></div>`;
        p.querySelectorAll('[data-kg]').forEach((button) => {
          button.onclick = () => {
            p.querySelectorAll('[data-kg]').forEach((option) =>
              option.setAttribute('aria-pressed', option === button),
            );
            $('#total').textContent = button.dataset.kg + ' kg';
          };
        });
      }
    }
    form.querySelectorAll('[name=type]').forEach((r) => (r.onchange = panel));
    panel();
    form.onsubmit = (e) => {
      e.preventDefault();
      let t = $('input[name=type]:checked', form).value,
        weight =
          t === 'barbell'
            ? {
                type: t,
                bar: +$('.choice-toggle [aria-pressed="true"]').dataset.bar,
                side: +$('#side').value,
              }
            : t === 'dumbbell'
              ? {
                  type: t,
                  count: +$('.choice-toggle [aria-pressed="true"]').dataset.count,
                  each: +$('#each').value,
                }
              : t === 'kettlebell'
                ? {
                    type: t,
                    kg: +$('#weight-panel [data-kg][aria-pressed="true"]').dataset.kg,
                  }
                : { type: 'body' },
        name = $('#name').value.trim();
      let result = { name, sets: +$('#sets').value, reps: +$('#reps').value, weight };
      if (index === null) active.exercises.push(result);
      else active.exercises[index] = result;
      if (!data.names.some((n) => n.toLowerCase() === name.toLowerCase()))
        data.names.push(name);
      save();
      renderActive();
    };
  }
  function finish() {
    if (!active.exercises.length && !confirm('Finish this session without exercises?'))
      return;
    data.sessions.push(active);
    save();
    active = null;
    location.hash = '#home';
    renderHome();
  }
  function renderSaved(id) {
    let s = data.sessions.find((x) => x.id === id);
    if (!s) {
      location.hash = '';
      return;
    }
    app.innerHTML = `<div class="session-head"><button class="back" id="saved-back">‹</button><div><h1>${esc(s.title)}</h1><p>${new Date(s.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p></div><button class="small-action delete session-actions" id="delete">Delete</button></div><div class="summary-card"><p>Session summary</p><b>${s.exercises.length} exercises · ${s.exercises.reduce((n, e) => n + e.sets, 0)} sets</b><p>Logged ${new Date(s.date).toLocaleDateString()}</p></div><div class="exercise-list">${s.exercises.map((e) => `<article class="exercise-card"><div class="exercise-card-head"><div style="flex:1"><h3>${esc(e.name)}</h3><p class="details">${e.sets} sets × ${e.reps} reps</p></div><span class="load-pill">${esc(loadText(e.weight))}</span></div></article>`).join('')}</div>`;
    $('#saved-back').onclick = () => {
      location.hash = '#home';
      renderHome();
    };
    $('#delete').onclick = () => {
      if (confirm('Delete this training session?')) {
        data.sessions = data.sessions.filter((x) => x.id !== id);
        save();
        location.hash = '#home';
        renderHome();
      }
    };
  }
  function route() {
    let m = location.hash.match(/^#session\/([^/]+)$/);
    if (m) renderSaved(decodeURIComponent(m[1]));
    else if (location.hash === '#home' || location.hash === '#history') renderHome();
    else startSession();
  }
  const dialog = $('#data-dialog');
  function backupJson() {
    return JSON.stringify({ format: 'form-training-log', version: 1, ...data }, null, 2);
  }
  function updateJsonPreview() {
    const json = backupJson();
    $('#json-preview').value = json;
    $('#json-character-count').textContent = `${json.length.toLocaleString()} characters`;
    $('#qr-result').hidden = true;
    $('#qr-button-note').textContent =
      json.length <= 1200
        ? 'For small backups only'
        : 'Backup is too large for a QR code';
    $('#show-qr').disabled = json.length > 1200;
    $('#qr-code').replaceChildren();
  }
  $('#menu-button').onclick = () => {
    dialog.showModal();
    $('#dialog-status').textContent = '';
    updateJsonPreview();
  };
  $('#close-dialog').onclick = () => dialog.close();
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  $('#export-json').onclick = () => {
    let blob = new Blob([backupJson()], { type: 'application/json' }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = `form-training-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    $('#dialog-status').textContent = 'Backup downloaded.';
  };
  $('#import-file').onchange = async (e) => {
    try {
      let parsed = JSON.parse(await e.target.files[0].text());
      if (
        !Array.isArray(parsed.sessions) ||
        parsed.sessions.some((s) => !Array.isArray(s.exercises))
      )
        throw Error('This file does not look like a Form backup.');
      data.sessions = parsed.sessions;
      data.names = [
        ...new Set([
          ...(data.names || []),
          ...(parsed.names || []),
          ...parsed.sessions.flatMap((s) =>
            s.exercises.map((x) => x.name).filter(Boolean),
          ),
        ]),
      ];
      save();
      $('#dialog-status').textContent = `Imported ${parsed.sessions.length} sessions.`;
      updateJsonPreview();
      renderHome();
    } catch (err) {
      $('#dialog-status').textContent = err.message || 'Could not read that file.';
    }
    e.target.value = '';
  };
  $('#copy-json').onclick = async () => {
    const json = backupJson();
    try {
      await navigator.clipboard.writeText(json);
      $('#dialog-status').textContent = 'JSON copied to clipboard.';
    } catch {
      const preview = $('#json-preview');
      preview.focus();
      preview.select();
      const copied = document.execCommand('copy');
      $('#dialog-status').textContent = copied
        ? 'JSON copied to clipboard.'
        : 'Copy was blocked. Select and copy the JSON text.';
    }
  };
  let qrLibraryPromise;
  function loadQrLibrary() {
    if (window.QRCode) return Promise.resolve(window.QRCode);
    if (!qrLibraryPromise) {
      qrLibraryPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
        script.integrity =
          'sha512-CNgIRecGo7nphbeZ04Sc13ka07paqdeTu0WR1IM4kNcpmBAUSHSQX0FslNhTDadL4O5SAGapGt4FodqL8My0mA==';
        script.crossOrigin = 'anonymous';
        script.referrerPolicy = 'no-referrer';
        script.onload = () =>
          window.QRCode
            ? resolve(window.QRCode)
            : reject(new Error('QR library did not load.'));
        script.onerror = () =>
          reject(
            new Error('Could not load the QR library. Check your internet connection.'),
          );
        document.head.append(script);
      });
    }
    return qrLibraryPromise;
  }
  $('#show-qr').onclick = async () => {
    const json = backupJson();
    if (json.length > 1200) return;
    const result = $('#qr-result');
    const status = $('#qr-status');
    const target = $('#qr-code');
    result.hidden = false;
    status.textContent = 'Loading QR support…';
    target.replaceChildren();
    try {
      const QRCode = await loadQrLibrary();
      if (json.length > 1200) throw new Error('Backup is too large for a QR code.');
      new QRCode(target, {
        text: json,
        width: 240,
        height: 240,
        correctLevel: QRCode.CorrectLevel.L,
      });
      status.textContent = 'Scan to transfer this JSON backup.';
    } catch (error) {
      status.textContent = error.message || 'Could not create a QR code.';
    }
  };
  $('#email-data').onclick = () => {
    let text =
        data.sessions
          .map(
            (s) =>
              `${new Date(s.date).toLocaleDateString()} — ${s.title}\n${s.exercises.map((e) => `• ${e.name}: ${e.sets} × ${e.reps}, ${loadText(e.weight)}`).join('\n')}`,
          )
          .join('\n\n') || 'No training sessions yet.',
      url =
        'mailto:?subject=' +
        encodeURIComponent('My training log') +
        '&body=' +
        encodeURIComponent(text);
    if (url.length > 1800) {
      $('#dialog-status').textContent =
        'Too much data for an email link. Use Export backup.';
      return;
    }
    location.href = url;
  };
  function updateNames() {
    if ($('#exercise-suggestions'))
      $('#exercise-suggestions').innerHTML = data.names
        .map((n) => `<option value="${esc(n)}">`)
        .join('');
  }
  let home = renderHome;
  renderHome = () => {
    home();
    updateNames();
  };
  window.addEventListener('hashchange', route);
  if ('serviceWorker' in navigator && location.protocol !== 'file:')
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  route();
})();
