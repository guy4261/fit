(() => {
  const KEY = 'form-training-log-v1',
    $ = (q, r = document) => r.querySelector(q),
    app = $('#app');
  const BARBELL_PLATES = [1.25, 2.5, 5, 10, 15, 20];
  let data = read(),
    active = null,
    reorderMode = false,
    validateActiveSessionTimes = () => true;
  function migrateSession(session) {
    const exercises = Array.isArray(session.exercises) ? session.exercises : [];
    const migratedStarts = exercises
      .map((exercise) => exercise.startTime)
      .filter(Boolean)
      .sort();
    const migratedEnds = exercises
      .map((exercise) => exercise.endTime)
      .filter(Boolean)
      .sort();
    const startTime =
      session.startTime || migratedStarts[0] || timeFromDate(session.date);
    let endTime = session.endTime || migratedEnds.at(-1) || '';
    if (startTime && endTime && endTime < startTime) endTime = '';
    return {
      ...session,
      startTime,
      endTime,
      exercises: exercises.map((exercise) => {
        if (!exercise || typeof exercise !== 'object') return exercise;
        const { startTime: _startTime, endTime: _endTime, ...savedExercise } = exercise;
        return savedExercise;
      }),
    };
  }
  function read() {
    try {
      let d = JSON.parse(localStorage.getItem(KEY) || '{}');
      return {
        sessions: Array.isArray(d.sessions) ? d.sessions.map(migrateSession) : [],
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
  function barbellPlateCounts(weight) {
    const counts = Object.fromEntries(BARBELL_PLATES.map((kg) => [String(kg), 0]));
    if (weight.plates && typeof weight.plates === 'object') {
      BARBELL_PLATES.forEach((kg) => {
        counts[String(kg)] = Math.max(
          0,
          Math.floor(Number(weight.plates[String(kg)]) || 0),
        );
      });
      return counts;
    }
    let remainingUnits = Math.max(0, Math.round((Number(weight.side) || 0) / 1.25));
    [...BARBELL_PLATES].reverse().forEach((kg) => {
      const units = kg / 1.25;
      counts[String(kg)] = Math.floor(remainingUnits / units);
      remainingUnits %= units;
    });
    return counts;
  }
  function barbellPerSide(weight) {
    if (weight.plates && typeof weight.plates === 'object') {
      return BARBELL_PLATES.reduce(
        (sum, kg) =>
          sum + kg * Math.max(0, Math.floor(Number(weight.plates[String(kg)]) || 0)),
        0,
      );
    }
    return Number(weight.side) || 0;
  }
  function readBarbellPlateCounts(panel) {
    return Object.fromEntries(
      BARBELL_PLATES.map((kg) => [
        String(kg),
        Number($(`[data-plate="${kg}"] [data-plate-count]`, panel).textContent),
      ]),
    );
  }
  function total(w) {
    return w.type === 'barbell'
      ? w.bar === 0
        ? barbellPerSide(w)
        : w.bar + 2 * barbellPerSide(w)
      : w.type === 'dumbbell'
        ? w.count * w.each
        : w.type === 'kettlebell'
          ? w.kg
          : w.type === 'plates'
            ? Number(w.integer) + Number(w.fraction)
            : 0;
  }
  function loadText(w) {
    if (w.type === 'body') return 'Body weight';
    const weight = total(w);
    const displayWeight =
      w.type === 'plates' && Number.isInteger(weight) ? weight.toFixed(1) : weight;
    return `${w.type === 'dumbbell' && w.count === 2 ? '2 × ' : ''}${displayWeight} kg`;
  }
  function sessionTitle(date) {
    return new Date(date).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }
  function currentTimeValue() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
  function timeFromDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  function bindSessionTimeInputs(session) {
    const startInput = $('#session-start-time');
    const endInput = $('#session-end-time');
    if (!startInput || !endInput) return () => true;
    const refresh = () => {
      endInput.min = startInput.value;
      endInput.setCustomValidity(
        endInput.value && (!startInput.value || endInput.value < startInput.value)
          ? 'End time must be the same as or later than start time.'
          : '',
      );
    };
    const synchronize = () => {
      refresh();
      session.startTime = startInput.value;
      session.endTime = endInput.value;
      if (session !== active && endInput.checkValidity()) save();
    };
    startInput.addEventListener('input', synchronize);
    startInput.addEventListener('change', synchronize);
    endInput.addEventListener('input', synchronize);
    endInput.addEventListener('change', synchronize);
    refresh();
    return () => {
      synchronize();
      return endInput.reportValidity();
    };
  }
  function exerciseHistory(name) {
    const matches = data.sessions.flatMap((session) =>
      session.exercises
        .filter(
          (exercise) =>
            String(exercise.name || '')
              .trim()
              .toLowerCase() === name.toLowerCase(),
        )
        .map((exercise) => ({
          session,
          exercise,
          weight: total(exercise.weight || { type: 'body' }),
        })),
    );
    if (!matches.length) return '<p class="exercise-history-first">First time ever!</p>';
    matches.sort((a, b) => new Date(a.session.date) - new Date(b.session.date));
    const record = matches.reduce((best, current) =>
      current.weight >= best.weight ? current : best,
    );
    const latest = matches.at(-1);
    const daysAgo = (date) => {
      const day = new Date(date);
      const today = new Date();
      const startOfToday = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );
      const startOfDay = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      const days = Math.max(0, Math.floor((startOfToday - startOfDay) / 86400000));
      return days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'} ago`;
    };
    const weightText = (weight, exercise) =>
      exercise.weight?.type === 'body'
        ? 'Body weight'
        : `${exercise.weight?.type === 'plates' && Number.isInteger(weight) ? weight.toFixed(1) : weight} kg`;
    const recordText = `All-time record: ${weightText(record.weight, record.exercise)} · ${daysAgo(record.session.date)}`;
    const latestText = `Last time: ${weightText(latest.weight, latest.exercise)} · ${daysAgo(latest.session.date)}`;
    return `<p>${esc(recordText)}</p>${latest.session !== record.session ? `<p>${esc(latestText)}</p>` : ''}`;
  }
  function renderHome() {
    const ss = [...data.sessions].sort((a, b) => new Date(b.date) - new Date(a.date));
    app.innerHTML = `<section class="hero"><button class="primary" id="start">＋ &nbsp;Start a session</button></section><div class="section-title"><h2>Training history</h2><span>${ss.length} ${ss.length === 1 ? 'session' : 'sessions'}</span></div>${
      ss.length
        ? `<div class="session-list">${ss
            .map((s) => {
              let d = new Date(s.date);
              return `<a href="#session/${encodeURIComponent(s.id)}" class="session-row"><span class="session-date"><b>${d.getDate()}</b><small>${d.toLocaleString(undefined, { month: 'short' })}</small></span><span class="session-info"><b>${esc(s.title)}</b><small>${s.exercises.length} exercises</small></span><span class="arrow">›</span></a>`;
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
      startTime: currentTimeValue(),
      endTime: '',
      exercises: [],
    };
    reorderMode = false;
    renderActive();
  }
  function renderActive() {
    const canReorder = active.exercises.length > 0;
    app.innerHTML = `<div class="session-head"><button class="back" id="back">‹</button><div><h1>${esc(active.title)}</h1><p>${active.exercises.length} exercises</p></div><button class="secondary session-actions" id="finish">Finish</button></div><div class="split-fields session-time-fields"><div class="field"><label for="session-start-time">Session start</label><input id="session-start-time" class="text-input" type="time" value="${esc(active.startTime || '')}"></div><div class="field"><label for="session-end-time">Session end</label><input id="session-end-time" class="text-input" type="time" value="${esc(active.endTime || '')}"></div></div><div class="reorder-toolbar"><div class="reorder-controls"><button class="secondary" id="reorder" type="button" ${canReorder ? '' : 'disabled'}>${reorderMode ? 'Save' : 'Reorder'}</button>${reorderMode ? '<div class="rotate-controls"><button class="rotate-action" id="rotate-exercises" type="button" aria-label="Move last exercise to the top" title="Move last exercise to the top" ' + (active.exercises.length < 2 ? 'disabled' : '') + '>↻</button><button class="rotate-action" id="rotate-exercises-reverse" type="button" aria-label="Move first exercise to the bottom" title="Move first exercise to the bottom" ' + (active.exercises.length < 2 ? 'disabled' : '') + '>↺</button></div>' : ''}</div></div><div class="section-title"><h2>Exercises</h2><span>${active.exercises.length} added</span></div><div class="exercise-list${reorderMode ? ' is-reordering' : ''}" id="exercise-list">${active.exercises.map((e, i) => `<article class="exercise-card${reorderMode ? ' is-draggable' : ''}" data-exercise-index="${i}"><div class="exercise-row"><span class="drag-handle" aria-hidden="true">⠿</span><div class="exercise-card-head"><div style="flex:1"><h3>${esc(e.name)}</h3></div><span class="load-pill">${esc(loadText(e.weight))}</span></div></div>${reorderMode ? '' : `<div class="card-controls"><button class="small-action" data-edit="${i}">Edit</button><button class="small-action" data-copy="${i}">Duplicate</button><button class="small-action delete" data-remove="${i}">Remove</button></div>`}</article>`).join('')}</div>${reorderMode ? '' : `<div class="exercise-actions"><button class="add-exercise" id="add"><span>＋</span> Add exercise</button><button class="scan-exercises" id="scan-exercises" type="button"><span aria-hidden="true">▦</span> ${canReorder ? 'Show QR' : 'Scan QR'}</button></div>`}${active.exercises.length ? '<div class="finish-bar"><button class="primary" id="finish-bottom">Finish session &nbsp; →</button></div>' : ''}`;
    validateActiveSessionTimes = bindSessionTimeInputs(active);
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
    $('#reorder').onclick = () => {
      reorderMode = !reorderMode;
      renderActive();
    };
    $('#add')?.addEventListener('click', () => exerciseForm());
    if (canReorder)
      $('#scan-exercises')?.addEventListener('click', () =>
        showSessionQr(active.exercises),
      );
    else $('#scan-exercises')?.addEventListener('click', openExerciseScanner);
    $('#rotate-exercises')?.addEventListener('click', () => {
      if (active.exercises.length < 2) return;
      active.exercises.unshift(active.exercises.pop());
      renderActive();
    });
    $('#rotate-exercises-reverse')?.addEventListener('click', () => {
      if (active.exercises.length < 2) return;
      active.exercises.push(active.exercises.shift());
      renderActive();
    });
    $('#finish').onclick = finish;
    $('#finish-bottom')?.addEventListener('click', finish);
    if (reorderMode) {
      const list = $('#exercise-list');
      let pointerDraggedIndex = null;
      let pointerStartY = 0;
      let pointerMoved = false;
      let pointerCard = null;
      list.querySelectorAll('.exercise-card').forEach((card) => {
        const handle = $('.drag-handle', card);
        handle.addEventListener('pointerdown', (event) => {
          if (event.pointerType === 'mouse' && event.button !== 0) return;
          pointerDraggedIndex = Number(card.dataset.exerciseIndex);
          pointerCard = card;
          pointerStartY = event.clientY;
          pointerMoved = false;
          handle.setPointerCapture(event.pointerId);
          card.classList.add('is-dragging');
          card.style.setProperty('--drag-x', '0px');
          card.style.setProperty('--drag-y', '0px');
          card.dataset.pointerStartX = String(event.clientX);
          card.dataset.pointerStartY = String(event.clientY);
          event.preventDefault();
        });
        handle.addEventListener('pointermove', (event) => {
          if (pointerDraggedIndex === null) return;
          if (Math.abs(event.clientY - pointerStartY) > 5) pointerMoved = true;
          if (!pointerMoved) return;
          pointerCard.style.setProperty(
            '--drag-x',
            `${event.clientX - Number(pointerCard.dataset.pointerStartX)}px`,
          );
          pointerCard.style.setProperty(
            '--drag-y',
            `${event.clientY - Number(pointerCard.dataset.pointerStartY)}px`,
          );
          const target = document
            .elementFromPoint(event.clientX, event.clientY)
            ?.closest('.exercise-card');
          if (!target || !list.contains(target)) return;
          if (target === pointerCard) return;
          const bounds = target.getBoundingClientRect();
          const insertAfter = event.clientY > bounds.top + bounds.height / 2;
          list.insertBefore(pointerCard, insertAfter ? target.nextSibling : target);
        });
        const finishPointerReorder = () => {
          if (pointerDraggedIndex === null) return;
          if (pointerMoved) {
            active.exercises = [...list.querySelectorAll('.exercise-card')].map(
              (item) => active.exercises[Number(item.dataset.exerciseIndex)],
            );
            renderActive();
          }
          pointerDraggedIndex = null;
          pointerCard = null;
          card.classList.remove('is-dragging');
          card.style.removeProperty('--drag-x');
          card.style.removeProperty('--drag-y');
          delete card.dataset.pointerStartX;
          delete card.dataset.pointerStartY;
        };
        handle.addEventListener('pointerup', finishPointerReorder);
        handle.addEventListener('pointercancel', finishPointerReorder);
      });
    }
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
  function exerciseForm(index = null, session = active) {
    let ex =
      index === null
        ? {
            name: '',
            sets: 1,
            reps: 1,
            weight: { type: 'body' },
          }
        : structuredClone(session.exercises[index]);
    const returnToSession = () =>
      session === active ? renderActive() : renderSaved(session.id);
    const numberWheel = (
      id,
      label,
      value,
      values = Array.from({ length: 1000 }, (_, number) => number),
      format = (number) => String(number).padStart(3, '0'),
    ) => {
      value = values.includes(Number(value)) ? Number(value) : values[0];
      return `<div class="number-wheel" id="${id}" role="spinbutton" tabindex="0" aria-label="${label}" aria-valuemin="${values[0]}" aria-valuemax="${values.at(-1)}" aria-valuenow="${value}" aria-valuetext="${value}" data-value="${value}"><div class="number-wheel-viewport"><div class="number-wheel-list">${values.map((number, index) => `<div class="number-wheel-item${number === value ? ' is-selected' : ''}" data-index="${index}" data-value="${number}" aria-hidden="true">${format(number)}</div>`).join('')}</div></div></div>`;
    };
    app.innerHTML = `<div class="session-head"><button class="back" id="form-back">‹</button><div><h1>${index === null ? 'Add exercise' : 'Edit exercise'}</h1><p>Build your session one movement at a time</p></div></div><form class="form-card" id="form"><div class="field"><label for="name">Exercise name</label><div class="exercise-name-row" id="name-container"><input id="name" class="text-input" list="exercise-suggestions" value="${esc(ex.name)}" placeholder="e.g. Goblet squat" required maxlength="60" autocomplete="off"><button class="name-lock-button" id="toggle-name-lock" type="button" aria-label="Save exercise name" title="Save exercise name">💾</button></div><div id="exercise-history" class="exercise-history" aria-live="polite" hidden></div></div><div class="split-fields exercise-count-fields"><div class="field"><label for="sets">Sets</label>${numberWheel('sets', 'Sets', ex.sets)}</div><div class="field"><label for="reps">Repetitions</label>${numberWheel('reps', 'Repetitions', ex.reps)}</div></div><div class="field"><span class="field-label">Load type</span><div class="weight-types">${[
      ['body', 'Body'],
      ['plates', 'Plates'],
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
    $('#form-back').onclick = returnToSession;
    $('#cancel').onclick = returnToSession;
    $('#toggle-name-lock').onclick = (event) => {
      const button = event.currentTarget;
      const input = $('#name', form);
      if (input) {
        const name = input.value.trim();
        if (!name) {
          input.reportValidity();
          return;
        }
        const label = document.createElement('span');
        label.id = 'name-label';
        label.className = 'locked-exercise-name';
        label.textContent = name;
        input.replaceWith(label);
        const history = $('#exercise-history', form);
        history.innerHTML = exerciseHistory(name);
        history.hidden = false;
        button.textContent = '✏️';
        button.setAttribute('aria-label', 'Edit exercise name');
        button.title = 'Edit exercise name';
      } else {
        const label = $('#name-label', form);
        const editable = document.createElement('input');
        editable.id = 'name';
        editable.className = 'text-input';
        editable.setAttribute('list', 'exercise-suggestions');
        editable.value = label.textContent;
        editable.placeholder = 'e.g. Goblet squat';
        editable.required = true;
        editable.maxLength = 60;
        editable.autocomplete = 'off';
        label.replaceWith(editable);
        $('#exercise-history', form).hidden = true;
        button.textContent = '💾';
        button.setAttribute('aria-label', 'Save exercise name');
        button.title = 'Save exercise name';
        editable.focus();
      }
    };
    function setupNumberWheel(
      id,
      values = Array.from({ length: 1000 }, (_, number) => number),
      onChange = null,
    ) {
      const wheel = $(`#${id}`, form);
      const viewport = $('.number-wheel-viewport', wheel);
      const items = viewport.querySelectorAll('.number-wheel-item');
      let selected = values.indexOf(Number(wheel.dataset.value));
      const updateSelected = (index) => {
        index = Math.max(0, Math.min(values.length - 1, index));
        items[selected].classList.remove('is-selected');
        selected = index;
        items[selected].classList.add('is-selected');
        const value = values[selected];
        wheel.dataset.value = String(value);
        wheel.setAttribute('aria-valuenow', String(value));
        wheel.setAttribute('aria-valuetext', String(value));
        onChange?.(value);
      };
      viewport.addEventListener(
        'scroll',
        () => updateSelected(Math.round(viewport.scrollTop / 44)),
        { passive: true },
      );
      viewport.addEventListener('click', (event) => {
        const item = event.target.closest('[data-index]');
        if (item) viewport.scrollTo({ top: Number(item.dataset.index) * 44 });
      });
      wheel.addEventListener('keydown', (event) => {
        const steps = event.key === 'PageUp' || event.key === 'PageDown' ? 10 : 1;
        let next;
        if (event.key === 'ArrowUp' || event.key === 'PageUp') next = selected + steps;
        else if (event.key === 'ArrowDown' || event.key === 'PageDown')
          next = selected - steps;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = 999;
        else return;
        event.preventDefault();
        viewport.scrollTo({ top: Math.max(0, Math.min(values.length - 1, next)) * 44 });
      });
      requestAnimationFrame(() => {
        viewport.scrollTop = selected * 44;
      });
    }
    setupNumberWheel('sets');
    setupNumberWheel('reps');
    function panel() {
      let t = $('input[name=type]:checked', form).value,
        w = ex.weight,
        p = $('#weight-panel');
      if (t === 'body') {
        p.innerHTML =
          '<div class="total-box" style="border:0;margin:0;padding:0"><span>No external load</span><b>Body</b></div>';
        return;
      }
      if (t === 'plates') {
        const integerValues = Array.from({ length: 201 }, (_, value) => value);
        const fractionValues = [0, 0.25, 0.5, 0.75];
        const integer = w.type === 'plates' ? w.integer : 0;
        const fraction = w.type === 'plates' ? w.fraction : 0;
        const initialTotal = integer + fraction;
        const formatPlateWeight = (value) =>
          Number.isInteger(value) ? value.toFixed(1) : String(value);
        p.innerHTML = `<div class="plates-wheels"><div class="plates-wheel-labels"><span>Whole kg</span><span>Fraction of kg</span></div><div class="plates-wheel-columns"><div class="plates-wheel-column">${numberWheel('plate-integer', 'Whole kilograms', integer, integerValues)}</div><div class="plates-wheel-column">${numberWheel('plate-fraction', 'Fractional kilograms', fraction, fractionValues, (value) => String(value))}</div></div></div><div class="total-box"><span>Total plates weight</span><b id="plates-total">${formatPlateWeight(initialTotal)} kg</b></div>`;
        const updatePlatesTotal = () => {
          const amount =
            Number($('#plate-integer', form).dataset.value) +
            Number($('#plate-fraction', form).dataset.value);
          $('#plates-total').textContent = `${formatPlateWeight(amount)} kg`;
        };
        setupNumberWheel('plate-integer', integerValues, updatePlatesTotal);
        setupNumberWheel('plate-fraction', fractionValues, updatePlatesTotal);
      } else if (t === 'barbell') {
        let bar = w.type === 'barbell' ? w.bar : 20,
          plates = barbellPlateCounts(w);
        p.innerHTML = `<div class="weight-row"><span class="weight-row-label">Bar weight</span><div class="choice-toggle" role="group" aria-label="Bar weight"><button type="button" data-bar="0" aria-label="Zero bar weight" aria-pressed="${bar === 0}">X</button><button type="button" data-bar="15" aria-pressed="${bar === 15}">15 kg</button><button type="button" data-bar="20" aria-pressed="${bar === 20}">20 kg</button></div></div><div class="barbell-plates"><div class="barbell-plates-head"><span class="weight-row-label" id="barbell-plate-label">${bar === 0 ? 'Plates for one hand' : 'Plates per side'}</span><button class="small-action" id="clear-barbell-plates" type="button">Clear all</button></div><div class="barbell-plate-grid" id="barbell-plate-grid" role="group" aria-label="Plate counts per side">${BARBELL_PLATES.map((kg) => `<div class="barbell-plate" data-plate="${kg}"><span class="barbell-plate-label">${kg} kg</span><div class="barbell-plate-controls"><button type="button" data-plate-step="1" aria-label="Add one ${kg} kilogram plate">＋</button><output data-plate-count>${plates[String(kg)]}</output><button type="button" data-plate-step="-1" aria-label="Remove one ${kg} kilogram plate">−</button></div></div>`).join('')}</div></div><div class="total-box"><span>Total barbell weight</span><b id="total" aria-live="polite">${bar === 0 ? barbellPerSide({ plates }) : bar + 2 * barbellPerSide({ plates })} kg</b></div>`;
        let up = () => {
          const selectedBar = +$('.choice-toggle [aria-pressed="true"]').dataset.bar;
          const perSide = barbellPerSide({ plates: readBarbellPlateCounts(p) });
          $('#barbell-plate-label', p).textContent =
            selectedBar === 0 ? 'Plates for one hand' : 'Plates per side';
          $('#barbell-plate-grid', p).setAttribute(
            'aria-label',
            selectedBar === 0 ? 'Plate counts for one hand' : 'Plate counts per side',
          );
          $('#total').textContent =
            (selectedBar === 0 ? perSide : selectedBar + 2 * perSide) + ' kg';
        };
        p.querySelectorAll('[data-bar]').forEach((button) => {
          button.onclick = () => {
            p.querySelectorAll('[data-bar]').forEach((option) =>
              option.setAttribute('aria-pressed', option === button),
            );
            up();
          };
        });
        p.querySelectorAll('[data-plate-step]').forEach((button) => {
          button.onclick = () => {
            const count = button.parentElement.querySelector('[data-plate-count]');
            count.textContent = String(
              Math.max(0, Number(count.textContent) + Number(button.dataset.plateStep)),
            );
            up();
          };
        });
        $('#clear-barbell-plates', p).onclick = () => {
          p.querySelectorAll('[data-plate-count]').forEach((count) => {
            count.textContent = '0';
          });
          up();
        };
      } else if (t === 'dumbbell') {
        const eachValues = [
          1.25, 2.5, 4, 5, 6, 7, 8, 9, 10, 12.5, 15, 17.5, 20, 22.5, 25,
        ];
        let count = w.type === 'dumbbell' ? w.count : 2,
          each = w.type === 'dumbbell' ? w.each : 10;
        if (!eachValues.includes(each)) {
          each = eachValues.reduce((closest, value) =>
            Math.abs(value - each) < Math.abs(closest - each) ? value : closest,
          );
        }
        p.innerHTML = `<div class="weight-row"><span class="weight-row-label">Dumbbells</span><div class="choice-toggle" role="group" aria-label="Number of dumbbells"><button type="button" data-count="1" aria-pressed="${count === 1}">1</button><button type="button" data-count="2" aria-pressed="${count === 2}">2</button></div></div><div class="plates-wheels single-weight-wheel"><div class="plates-wheel-labels"><span>Each (kg)</span></div><div class="plates-wheel-columns"><div class="plates-wheel-column">${numberWheel('each', 'Weight of each dumbbell', each, eachValues, (value) => String(value))}</div></div></div><div class="total-box"><span>Total weight</span><b id="total">${count * each} kg</b></div>`;
        let up = () => {
          $('#total').textContent =
            +$('.choice-toggle [aria-pressed="true"]').dataset.count *
              +$('#each').dataset.value +
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
        setupNumberWheel('each', eachValues, up);
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
      if (!form.reportValidity()) return;
      let t = $('input[name=type]:checked', form).value,
        weight =
          t === 'barbell'
            ? {
                type: t,
                bar: +$('.choice-toggle [aria-pressed="true"]').dataset.bar,
                side: barbellPerSide({
                  plates: readBarbellPlateCounts($('#weight-panel', form)),
                }),
                plates: readBarbellPlateCounts($('#weight-panel', form)),
              }
            : t === 'dumbbell'
              ? {
                  type: t,
                  count: +$('.choice-toggle [aria-pressed="true"]').dataset.count,
                  each: +$('#each').dataset.value,
                }
              : t === 'kettlebell'
                ? {
                    type: t,
                    kg: +$('#weight-panel [data-kg][aria-pressed="true"]').dataset.kg,
                  }
                : t === 'plates'
                  ? {
                      type: t,
                      integer: Number($('#plate-integer', form).dataset.value),
                      fraction: Number($('#plate-fraction', form).dataset.value),
                    }
                  : { type: 'body' },
        name = (
          $('#name', form)?.value ??
          $('#name-label', form)?.textContent ??
          ''
        ).trim();
      let result = {
        name,
        sets: Number($('#sets', form).dataset.value),
        reps: Number($('#reps', form).dataset.value),
        weight,
      };
      if (index === null) session.exercises.push(result);
      else session.exercises[index] = result;
      if (!data.names.some((n) => n.toLowerCase() === name.toLowerCase()))
        data.names.push(name);
      save();
      returnToSession();
    };
  }
  function finish() {
    if (!validateActiveSessionTimes()) return;
    if (!active.exercises.length && !confirm('Finish this session without exercises?'))
      return;
    data.sessions.push(active);
    save();
    active = null;
    location.hash = '#home';
    renderHome();
  }
  const scanDialog = $('#scan-dialog');
  let scanLibraryPromise = null;
  let scanStream = null;
  let scanAnimation = null;
  function loadJsQr() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    if (!scanLibraryPromise) {
      scanLibraryPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
        script.integrity =
          'sha384-b5Ya4Bq3qCyz39m2ISh+4DxjAIljdeFwK/BsXLuj9gugaNwAcj/ia15fxNZL9Nlx';
        script.crossOrigin = 'anonymous';
        script.referrerPolicy = 'no-referrer';
        script.onload = () =>
          window.jsQR
            ? resolve(window.jsQR)
            : reject(new Error('QR scanning support did not load.'));
        script.onerror = () => reject(new Error('Could not load QR scanning support.'));
        document.head.append(script);
      }).catch((error) => {
        scanLibraryPromise = null;
        throw error;
      });
    }
    return scanLibraryPromise;
  }
  function stopExerciseScanner() {
    if (scanAnimation !== null) cancelAnimationFrame(scanAnimation);
    scanAnimation = null;
    scanStream?.getTracks().forEach((track) => track.stop());
    scanStream = null;
    const video = $('#scan-video');
    if (video) video.srcObject = null;
  }
  async function openExerciseScanner() {
    scanDialog.showModal();
    $('#scan-status').textContent = 'Loading scanner and requesting camera…';
    try {
      const jsQR = await loadJsQr();
      if (!scanDialog.open) return;
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error('Camera access is not available in this browser.');
      scanStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      });
      if (!scanDialog.open) {
        stopExerciseScanner();
        return;
      }
      const video = $('#scan-video');
      video.srcObject = scanStream;
      await video.play();
      $('#scan-status').textContent = 'Point the camera at an exercise QR code.';
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      const scanFrame = () => {
        if (!scanDialog.open || !video.videoWidth) {
          scanAnimation = requestAnimationFrame(scanFrame);
          return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(image.data, image.width, image.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (result) {
          try {
            const parsed = JSON.parse(result.data);
            if (
              !Array.isArray(parsed) ||
              parsed.some((name) => typeof name !== 'string' || !name.trim())
            ) {
              throw new Error('The QR code must contain a JSON list of exercise names.');
            }
            const names = [...new Set(parsed.map((name) => name.trim()))];
            if (!names.length) throw new Error('The QR code does not contain any names.');
            for (const name of names) {
              if (
                !data.names.some(
                  (savedName) => savedName.toLowerCase() === name.toLowerCase(),
                )
              )
                data.names.push(name);
              active.exercises.push({
                name,
                sets: 1,
                reps: 1,
                weight: { type: 'body' },
              });
            }
            save();
            updateNames();
            stopExerciseScanner();
            scanDialog.close();
            renderActive();
            return;
          } catch (error) {
            $('#scan-status').textContent =
              error instanceof SyntaxError
                ? 'This QR code is not valid JSON. Keep scanning or close the scanner.'
                : error.message;
          }
        }
        scanAnimation = requestAnimationFrame(scanFrame);
      };
      scanAnimation = requestAnimationFrame(scanFrame);
    } catch (error) {
      stopExerciseScanner();
      $('#scan-status').textContent =
        error.name === 'NotAllowedError'
          ? 'Camera access was denied. Allow camera access and try again.'
          : error.message || 'Could not open the camera.';
    }
  }
  $('#close-scan').onclick = () => scanDialog.close();
  scanDialog.addEventListener('close', stopExerciseScanner);
  scanDialog.addEventListener('cancel', stopExerciseScanner);
  function renderSaved(id) {
    let s = data.sessions.find((x) => x.id === id);
    if (!s) {
      location.hash = '';
      return;
    }
    app.innerHTML = `<div class="session-head"><button class="back" id="saved-back">‹</button><div><h1>${esc(s.title)}</h1><p>${new Date(s.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p></div><button class="small-action delete session-actions" id="delete">Delete</button></div><div class="split-fields session-time-fields"><div class="field"><label for="session-start-time">Session start</label><input id="session-start-time" class="text-input" type="time" value="${esc(s.startTime || '')}"></div><div class="field"><label for="session-end-time">Session end</label><input id="session-end-time" class="text-input" type="time" value="${esc(s.endTime || '')}"></div></div><div class="summary-card"><p>Session summary</p><b>${s.exercises.length} exercises</b><p>Logged ${new Date(s.date).toLocaleDateString()}</p></div><button class="scan-exercises saved-show-qr" id="saved-show-qr" type="button"><span aria-hidden="true">▦</span> Show QR</button><div class="exercise-list">${s.exercises.map((e, i) => `<article class="exercise-card"><div class="exercise-card-head"><div style="flex:1"><h3>${esc(e.name)}</h3></div><span class="load-pill">${esc(loadText(e.weight))}</span></div><div class="card-controls"><button class="small-action" data-saved-edit="${i}">Edit</button></div></article>`).join('')}</div>`;
    bindSessionTimeInputs(s);
    $('#saved-back').onclick = () => {
      location.hash = '#home';
      renderHome();
    };
    $('#saved-show-qr').onclick = () => showSessionQr(s.exercises);
    app.querySelectorAll('[data-saved-edit]').forEach((button) => {
      button.onclick = () => exerciseForm(Number(button.dataset.savedEdit), s);
    });
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
    a.download = `fit24-training-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    $('#dialog-status').textContent = 'Backup downloaded.';
  };
  const barbellPlateColumns = BARBELL_PLATES.map((kg) => `${kg} kg plates per side`);
  const csvColumns = [
    'Session ID',
    'Session date',
    'Session title',
    'Session start time',
    'Session end time',
    'Exercise order',
    'Exercise name',
    'Sets',
    'Repetitions',
    'Weight type',
    'Bar kg',
    'Per side kg',
    ...barbellPlateColumns,
    'Dumbbells',
    'Each kg',
    'Kettlebell kg',
    'Plates whole kg',
    'Plates fraction kg',
  ];
  function csvCell(value) {
    let text = String(value ?? '');
    if (typeof value === 'string' && /^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }
  function sessionCsv() {
    const rows = [csvColumns];
    data.sessions.forEach((session) => {
      const exercises = session.exercises.length ? session.exercises : [null];
      exercises.forEach((exercise, order) => {
        const weight = exercise?.weight || {};
        rows.push([
          session.id,
          session.date,
          session.title,
          session.startTime || '',
          session.endTime || '',
          exercise ? order : '',
          exercise?.name || '',
          exercise?.sets ?? '',
          exercise?.reps ?? '',
          weight.type || '',
          weight.type === 'barbell' ? weight.bar : '',
          weight.type === 'barbell' ? weight.side : '',
          ...BARBELL_PLATES.map((kg) =>
            weight.type === 'barbell' && weight.plates ? weight.plates[String(kg)] : '',
          ),
          weight.type === 'dumbbell' ? weight.count : '',
          weight.type === 'dumbbell' ? weight.each : '',
          weight.type === 'kettlebell' ? weight.kg : '',
          weight.type === 'plates' ? weight.integer : '',
          weight.type === 'plates' ? weight.fraction : '',
        ]);
      });
    });
    return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  }
  $('#export-csv').onclick = () => {
    const blob = new Blob([sessionCsv()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fit24-training-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    $('#dialog-status').textContent = 'Spreadsheet downloaded as a CSV file.';
  };
  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i += 1) {
      const character = text[i];
      if (inQuotes) {
        if (character === '"' && text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else if (character === '"') {
          inQuotes = false;
        } else {
          field += character;
        }
      } else if (character === '"' && field === '') {
        inQuotes = true;
      } else if (character === ',') {
        row.push(field);
        field = '';
      } else if (character === '\n' || character === '\r') {
        if (character === '\r' && text[i + 1] === '\n') i += 1;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += character;
      }
    }
    if (inQuotes) throw new Error('This CSV has an unfinished quoted field.');
    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }
  function importCsv(text) {
    const [headerRow, ...rows] = parseCsv(text);
    if (!headerRow) throw new Error('This CSV file is empty.');
    const headers = new Map(
      headerRow.map((header, index) => [header.trim().toLowerCase(), index]),
    );
    const required = [
      'session id',
      'session date',
      'session title',
      'exercise order',
      'exercise name',
      'sets',
      'repetitions',
      'weight type',
      'bar kg',
      'per side kg',
      'dumbbells',
      'each kg',
      'kettlebell kg',
      'plates whole kg',
      'plates fraction kg',
    ];
    const plateColumnsPresent = barbellPlateColumns.filter((column) =>
      headers.has(column.toLowerCase()),
    ).length;
    if (plateColumnsPresent > 0 && plateColumnsPresent < barbellPlateColumns.length)
      throw new Error('This CSV has incomplete barbell plate columns.');
    const hasBarbellPlateColumns = plateColumnsPresent === barbellPlateColumns.length;
    if (required.some((header) => !headers.has(header)))
      throw new Error('This CSV does not look like a fit24 spreadsheet.');
    const readCell = (cells, label) => {
      const value = cells[headers.get(label)]?.trim() || '';
      return value.replace(/^'(?=[\t\r ]*[=+\-@])/, '');
    };
    const readNumber = (cells, label, fallback = 0) => {
      const raw = readCell(cells, label);
      if (!raw) return fallback;
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new Error(`Invalid number in “${label}”.`);
      return value;
    };
    const readTime = (cells, label) => {
      const raw = readCell(cells, label);
      if (!raw) return '';
      const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
      if (!match) throw new Error(`Invalid time in “${label}”.`);
      let hour = Number(match[1]);
      const minute = Number(match[2]);
      if (minute > 59) throw new Error(`Invalid time in “${label}”.`);
      if (match[3]) {
        if (hour < 1 || hour > 12) throw new Error(`Invalid time in “${label}”.`);
        hour = (hour % 12) + (match[3].toUpperCase() === 'PM' ? 12 : 0);
      }
      if (hour > 23) throw new Error(`Invalid time in “${label}”.`);
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    };
    const sessions = new Map();
    rows.forEach((cells, rowIndex) => {
      if (cells.every((cell) => !cell.trim())) return;
      const date = readCell(cells, 'session date');
      const title = readCell(cells, 'session title');
      const parsedDate = new Date(date);
      if (!date || !title || Number.isNaN(parsedDate.getTime()))
        throw new Error(
          `Missing or invalid session date/title on CSV row ${rowIndex + 2}.`,
        );
      const providedId = readCell(cells, 'session id');
      const key = providedId || `${date}\u0000${title}`;
      const startColumn = headers.has('session start time')
        ? 'session start time'
        : 'start time';
      const endColumn = headers.has('session end time') ? 'session end time' : 'end time';
      const startTime = readTime(cells, startColumn);
      const endTime = readTime(cells, endColumn);
      if (endTime && (!startTime || endTime < startTime))
        throw new Error(
          `End time must be at or after start time on CSV row ${rowIndex + 2}.`,
        );
      if (!sessions.has(key)) {
        sessions.set(key, {
          session: {
            id: providedId || crypto.randomUUID?.() || String(Date.now() + rowIndex),
            date: parsedDate.toISOString(),
            title,
            startTime,
            endTime,
            exercises: [],
          },
          exercises: [],
        });
      }
      const importedSession = sessions.get(key).session;
      if (
        startTime &&
        (!importedSession.startTime || startTime < importedSession.startTime)
      )
        importedSession.startTime = startTime;
      if (endTime && (!importedSession.endTime || endTime > importedSession.endTime))
        importedSession.endTime = endTime;
      const exerciseName = readCell(cells, 'exercise name');
      if (!exerciseName) return;
      const weightType = readCell(cells, 'weight type').toLowerCase();
      if (!['body', 'barbell', 'dumbbell', 'kettlebell', 'plates'].includes(weightType))
        throw new Error(`Unknown weight type on CSV row ${rowIndex + 2}.`);
      const weight =
        weightType === 'barbell'
          ? {
              type: weightType,
              bar: readNumber(cells, 'bar kg'),
              side: readNumber(cells, 'per side kg'),
              ...(hasBarbellPlateColumns &&
              barbellPlateColumns.some((column) => readCell(cells, column.toLowerCase()))
                ? {
                    plates: Object.fromEntries(
                      BARBELL_PLATES.map((kg, index) => [
                        String(kg),
                        readNumber(cells, barbellPlateColumns[index].toLowerCase()),
                      ]),
                    ),
                  }
                : {}),
            }
          : weightType === 'dumbbell'
            ? {
                type: weightType,
                count: readNumber(cells, 'dumbbells', 1),
                each: readNumber(cells, 'each kg'),
              }
            : weightType === 'kettlebell'
              ? { type: weightType, kg: readNumber(cells, 'kettlebell kg') }
              : weightType === 'plates'
                ? {
                    type: weightType,
                    integer: readNumber(cells, 'plates whole kg'),
                    fraction: readNumber(cells, 'plates fraction kg'),
                  }
                : { type: 'body' };
      sessions.get(key).exercises.push({
        order: readNumber(cells, 'exercise order', rowIndex),
        rowIndex,
        exercise: {
          name: exerciseName,
          sets: readNumber(cells, 'sets', 1),
          reps: readNumber(cells, 'repetitions', 1),
          weight,
        },
      });
    });
    return [...sessions.values()].map(({ session, exercises }) => {
      session.exercises = exercises
        .sort((a, b) => a.order - b.order || a.rowIndex - b.rowIndex)
        .map((item) => item.exercise);
      return session;
    });
  }
  $('#import-csv-file').onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const importedSessions = importCsv(await file.text());
      const importedNames = importedSessions.flatMap((session) =>
        session.exercises.map((exercise) => exercise.name),
      );
      data.sessions = importedSessions;
      data.names = [
        ...new Map(
          [...data.names, ...importedNames].map((name) => [name.toLowerCase(), name]),
        ).values(),
      ];
      save();
      $('#dialog-status').textContent =
        `Imported ${importedSessions.length} sessions from the spreadsheet.`;
      updateJsonPreview();
      renderHome();
    } catch (error) {
      $('#dialog-status').textContent = error.message || 'Could not read that CSV file.';
    }
    event.target.value = '';
  };
  $('#import-file').onchange = async (e) => {
    try {
      let parsed = JSON.parse(await e.target.files[0].text());
      if (
        !Array.isArray(parsed.sessions) ||
        parsed.sessions.some((s) => !Array.isArray(s.exercises))
      )
        throw Error('This file does not look like a fit24 backup.');
      data.sessions = parsed.sessions.map(migrateSession);
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
  const sessionQrDialog = $('#session-qr-dialog');
  $('#close-session-qr').onclick = () => sessionQrDialog.close();
  sessionQrDialog.addEventListener('click', (event) => {
    if (event.target === sessionQrDialog) sessionQrDialog.close();
  });
  async function showSessionQr(exercises) {
    const namesJson = JSON.stringify(exercises.map((exercise) => exercise.name));
    const target = $('#session-qr-code');
    const status = $('#session-qr-status');
    target.replaceChildren();
    sessionQrDialog.showModal();
    if (namesJson.length > 1200) {
      status.textContent =
        'This exercise list is too long for a QR code. Shorten some names to share it.';
      return;
    }
    status.textContent = 'Preparing QR code…';
    try {
      const QRCode = await loadQrLibrary();
      if (!sessionQrDialog.open) return;
      new QRCode(target, {
        text: namesJson,
        width: 260,
        height: 260,
        correctLevel: QRCode.CorrectLevel.L,
      });
      status.textContent = `${exercises.length} exercise${exercises.length === 1 ? '' : 's'} in their current order.`;
    } catch (error) {
      status.textContent = error.message || 'Could not create a QR code.';
    }
  }
  $('#email-data').onclick = () => {
    let text =
        data.sessions
          .map(
            (s) =>
              `${new Date(s.date).toLocaleDateString()} — ${s.title}\n${s.exercises.map((e) => `• ${e.name}: ${loadText(e.weight)}`).join('\n')}`,
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
