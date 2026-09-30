(() => {
  const KEY = 'form-training-log-v1',
    $ = (q, r = document) => r.querySelector(q),
    app = $('#app');
  const BARBELL_PLATES = [1.25, 2.5, 5, 10, 15, 20];
  const REPS_TYPES = ['Per-Side', 'Reps', 'Seconds'];
  const STANDARD_EXERCISES = [
    'Back Squat',
    'Banded Tricep Pulldown',
    'Bench Press',
    'Bent-Over Row',
    'Deadlift',
    'Hip Thrust',
    'Knee Abduction',
    'Knees to Chest',
    'Pull Over',
    'Pull Up',
    'Push Press',
    'Push Up',
    'Shoulder Lateral Raises',
    'Shoulder Press',
    'Squat',
    'Step Up',
    'Sumo Squat',
    'Triceps Ex',
  ];
  const EXAMPLE_SESSION = {
    id: 'example-session-2026-01-01',
    date: '2026-01-01T09:00:00.000Z',
    title: 'Example Session',
    startTime: '09:00',
    endTime: '09:35',
    exercises: [
      {
        name: 'Push Up',
        sets: 2,
        reps: 10,
        weight: { type: 'body' },
        setEntries: [
          { reps: 8, weight: { type: 'body' } },
          { reps: 10, weight: { type: 'body' } },
        ],
      },
      {
        name: 'Shoulder Lateral Raises',
        sets: 3,
        reps: 12,
        weight: { type: 'plates', integer: 0, fraction: 0.25 },
        setEntries: [
          { reps: 10, weight: { type: 'plates', integer: 0, fraction: 0.25 } },
          { reps: 12, weight: { type: 'plates', integer: 0, fraction: 0.25 } },
          { reps: 10, weight: { type: 'plates', integer: 0, fraction: 0.25 } },
        ],
      },
      {
        name: 'Back Squat',
        sets: 3,
        reps: 6,
        weight: {
          type: 'barbell',
          bar: 15,
          side: 0,
          plates: { 1.25: 0, 2.5: 0, 5: 0, 10: 0, 15: 0, 20: 0 },
        },
        setEntries: [
          {
            reps: 8,
            weight: {
              type: 'barbell',
              bar: 15,
              side: 0,
              plates: { 1.25: 0, 2.5: 0, 5: 0, 10: 0, 15: 0, 20: 0 },
            },
          },
          {
            reps: 7,
            weight: {
              type: 'barbell',
              bar: 15,
              side: 0,
              plates: { 1.25: 0, 2.5: 0, 5: 0, 10: 0, 15: 0, 20: 0 },
            },
          },
          {
            reps: 6,
            weight: {
              type: 'barbell',
              bar: 15,
              side: 0,
              plates: { 1.25: 0, 2.5: 0, 5: 0, 10: 0, 15: 0, 20: 0 },
            },
          },
        ],
      },
      {
        name: 'Shoulder Press',
        sets: 3,
        reps: 10,
        weight: { type: 'dumbbell', count: 1, each: 1.25 },
        setEntries: [
          { reps: 8, weight: { type: 'dumbbell', count: 1, each: 1.25 } },
          { reps: 10, weight: { type: 'dumbbell', count: 1, each: 1.25 } },
          { reps: 8, weight: { type: 'dumbbell', count: 1, each: 1.25 } },
        ],
      },
      {
        name: 'Deadlift',
        sets: 3,
        reps: 10,
        weight: { type: 'kettlebell', kg: 12, count: 1 },
        setEntries: [
          { reps: 8, weight: { type: 'kettlebell', kg: 12, count: 1 } },
          { reps: 10, weight: { type: 'kettlebell', kg: 12, count: 1 } },
          { reps: 12, weight: { type: 'kettlebell', kg: 12, count: 1 } },
        ],
      },
    ],
  };
  const normalizeExerciseName = (name) =>
    String(name || '')
      .trim()
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase();
  function preferredExerciseName(name) {
    const normalized = normalizeExerciseName(name);
    const standard = STANDARD_EXERCISES.find(
      (exercise) => normalizeExerciseName(exercise) === normalized,
    );
    if (standard) return standard;
    return String(name || '')
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map((word) =>
        word === word.toLocaleUpperCase()
          ? word
          : word.charAt(0).toLocaleUpperCase() + word.slice(1),
      )
      .join(' ');
  }
  let data = read(),
    active = null,
    reorderMode = false,
    historyOrder =
      localStorage.getItem('form-training-log-history-order') === 'oldest'
        ? 'oldest'
        : 'latest',
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
      const stored = localStorage.getItem(KEY);
      let d = JSON.parse(stored || '{}');
      if (stored === null) {
        const initial = { sessions: [EXAMPLE_SESSION], names: [] };
        localStorage.setItem(KEY, JSON.stringify(initial));
        d = initial;
      }
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
          ? (w.count || 1) * w.kg
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
  function setSummaryHtml(exercise) {
    const entries = Array.isArray(exercise.setEntries) ? exercise.setEntries : [];
    if (!entries.length) return '';
    const reps = entries.map((set) => Number(set.reps) || 0).join(' / ');
    const repsType = REPS_TYPES.includes(entries[0].reps_type)
      ? entries[0].reps_type
      : 'Reps';
    const repsLabel =
      entries.length === 1
        ? `${reps} ${repsType.toLowerCase() === 'reps' ? `rep${Number(entries[0].reps) === 1 ? '' : 's'}` : repsType.toLowerCase()}`
        : `${reps} ${repsType.toLowerCase()}`;
    return `<p class="details">${entries.length} set${entries.length === 1 ? '' : 's'} · ${repsLabel}</p>`;
  }
  function exerciseNoteHtml(exercise) {
    const note = typeof exercise.note === 'string' ? exercise.note.trim() : '';
    return note ? `<p class="exercise-note">${esc(note)}</p>` : '';
  }
  function partOfDay(hour) {
    var rv = null;
    switch (true) {
      case 4 <= hour && hour < 12:
        rv = 'Morning';
        break;
      case 12 <= hour && hour < 16:
        rv = 'Noon';
        break;
      case 16 <= hour && hour < 19:
        rv = 'Afternoon';
        break;
      case 19 <= hour && hour < 22:
        rv = 'Evening';
        break;
      case 22 <= hour && hour < 24:
      case 0 <= hour && hour < 4:
        rv = 'Night';
        break;
    }
    return rv;
  }
  function sessionTitle(date) {
    const d = new Date(date);
    var rv = d.toLocaleString(undefined, {
      dateStyle: 'medium',
    });
    rv += ` ${partOfDay(d.getHours())}`;
    return rv;
  }
  function defaultSessionName(date) {
    return sessionTitle(date);
  }
  function bindSessionName(session, isActive) {
    const label = $('#session-name');
    const button = $('#edit-session-name');
    if (!label || !button) return;
    button.onclick = () => {
      if (button.dataset.editing === 'true') {
        const input = $('#session-name-input');
        const title = input.value.trim();
        if (!title) {
          input.setCustomValidity('Enter a session name.');
          input.reportValidity();
          return;
        }
        session.title = title;
        if (!isActive) save();
        label.textContent = title;
        label.hidden = false;
        input.remove();
        button.textContent = '✎';
        button.setAttribute('aria-label', 'Edit session name');
        button.title = 'Edit session name';
        button.dataset.editing = 'false';
        return;
      }
      const input = document.createElement('input');
      input.id = 'session-name-input';
      input.className = 'text-input session-name-input';
      input.type = 'text';
      input.value = session.title;
      input.maxLength = 100;
      input.setAttribute('aria-label', 'Session name');
      label.hidden = true;
      label.after(input);
      button.textContent = '💾';
      button.setAttribute('aria-label', 'Save session name');
      button.title = 'Save session name';
      button.dataset.editing = 'true';
      input.focus();
      input.select();
    };
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
  function exercisePerformances(name) {
    name = preferredExerciseName(name);
    return data.sessions
      .flatMap((session) =>
        (session.exercises || []).flatMap((exercise, exerciseIndex) => {
          if (
            String(exercise.name || '')
              .trim()
              .toLowerCase() !== name.toLowerCase()
          )
            return [];
          const sets =
            Array.isArray(exercise.setEntries) && exercise.setEntries.length
              ? exercise.setEntries
              : [{ weight: exercise.weight || { type: 'body' }, reps: exercise.reps }];
          return sets.map((set, setIndex) => ({
            session,
            exercise,
            exerciseIndex,
            setIndex,
            weightData: set.weight || exercise.weight || { type: 'body' },
            weight: total(set.weight || exercise.weight || { type: 'body' }),
            reps: Math.max(0, Number(set.reps) || 0),
          }));
        }),
      )
      .sort(
        (a, b) =>
          new Date(a.session.date) - new Date(b.session.date) ||
          a.exerciseIndex - b.exerciseIndex ||
          a.setIndex - b.setIndex,
      );
  }
  function exerciseHistory(name) {
    const matches = exercisePerformances(name);
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
    const weightText = (performance) =>
      performance.weightData?.type === 'body'
        ? 'Body weight'
        : `${performance.weightData?.type === 'plates' && Number.isInteger(performance.weight) ? performance.weight.toFixed(1) : performance.weight} kg`;
    const recordText = `All-time record: ${weightText(record)} · ${daysAgo(record.session.date)}`;
    const latestText = `Last time: ${weightText(latest)} · ${daysAgo(latest.session.date)}`;
    return `<p>${esc(recordText)}</p>${latest.session !== record.session ? `<p>${esc(latestText)}</p>` : ''}`;
  }
  function renderHome() {
    const ss = [...data.sessions].sort(
      (a, b) =>
        (new Date(a.date) - new Date(b.date)) * (historyOrder === 'oldest' ? 1 : -1),
    );
    const selectedIds = new Set();
    app.innerHTML = `<section class="hero"><button class="primary" id="start">＋ &nbsp;Start a session</button></section><div class="section-title history-title"><div><h2>Training history</h2><span>${ss.length} ${ss.length === 1 ? 'session' : 'sessions'}</span></div><button class="secondary history-order" id="history-order" type="button" aria-label="Show ${historyOrder === 'latest' ? 'oldest' : 'latest'} sessions first" title="Show ${historyOrder === 'latest' ? 'oldest' : 'latest'} sessions first">${historyOrder === 'latest' ? '↑' : '↓'}</button></div>${
      ss.length
        ? `<div class="history-selection"><label class="select-all"><input type="checkbox" id="select-all-sessions"><span>Select all</span></label><button class="secondary history-delete-selected" id="delete-selected" type="button" disabled>Delete selected <span id="selected-count">0</span></button></div><div class="session-list">${ss
            .map((s) => {
              let d = new Date(s.date);
              return `<div class="session-row"><label class="session-select" aria-label="Select ${esc(s.title)}"><input type="checkbox" data-session-select="${esc(s.id)}"><span class="visually-hidden">Select session</span></label><a href="#session/${encodeURIComponent(s.id)}" class="session-link"><span class="session-date"><b>${d.getDate()}</b><small>${d.toLocaleString(undefined, { month: 'short' })}</small></span><span class="session-info"><b>${esc(s.title)}</b><small>${s.exercises.length} exercises</small></span></a><button type="button" class="session-delete" data-session-delete="${esc(s.id)}" aria-label="Delete ${esc(s.title)}" title="Delete session">Delete</button></div>`;
            })
            .join('')}</div>`
        : `<div class="empty"><div class="empty-icon">🏋️</div><b>Your first session starts here</b>Your training history will show up after you finish a session.</div>`
    }`;
    $('#start').onclick = () => {
      startSession();
    };
    $('#history-order').onclick = () => {
      historyOrder = historyOrder === 'latest' ? 'oldest' : 'latest';
      localStorage.setItem('form-training-log-history-order', historyOrder);
      renderHome();
    };
    const selectAll = $('#select-all-sessions');
    if (selectAll) {
      const boxes = [...app.querySelectorAll('[data-session-select]')];
      const updateSelection = () => {
        const count = boxes.filter((box) => box.checked).length;
        $('#selected-count').textContent = count;
        $('#delete-selected').disabled = count === 0;
        selectAll.checked = count === boxes.length;
        selectAll.indeterminate = count > 0 && count < boxes.length;
      };
      boxes.forEach((box) =>
        box.addEventListener('change', () => {
          if (box.checked) selectedIds.add(box.dataset.sessionSelect);
          else selectedIds.delete(box.dataset.sessionSelect);
          updateSelection();
        }),
      );
      selectAll.addEventListener('change', () => {
        boxes.forEach((box) => {
          box.checked = selectAll.checked;
          if (box.checked) selectedIds.add(box.dataset.sessionSelect);
          else selectedIds.delete(box.dataset.sessionSelect);
        });
        updateSelection();
      });
      $('#delete-selected').onclick = () => {
        if (
          !selectedIds.size ||
          !confirm(
            `Delete ${selectedIds.size} selected ${selectedIds.size === 1 ? 'session' : 'sessions'}? This cannot be undone.`,
          )
        )
          return;
        data.sessions = data.sessions.filter(
          (session) => !selectedIds.has(String(session.id)),
        );
        save();
        renderHome();
      };
      app.querySelectorAll('[data-session-delete]').forEach((button) => {
        button.onclick = () => {
          const session = data.sessions.find(
            (item) => String(item.id) === button.dataset.sessionDelete,
          );
          if (!session || !confirm(`Delete “${session.title}”? This cannot be undone.`))
            return;
          data.sessions = data.sessions.filter(
            (item) => String(item.id) !== button.dataset.sessionDelete,
          );
          save();
          renderHome();
        };
      });
    }
  }
  function renderAchievements() {
    const exerciseMap = new Map();
    data.sessions.forEach((session) => {
      (session.exercises || []).forEach((exercise) => {
        const name = String(exercise.name || '').trim();
        if (!name) return;
        const key = name.toLocaleLowerCase();
        if (!exerciseMap.has(key)) exerciseMap.set(key, { name, entries: [] });
        const setEntries =
          Array.isArray(exercise.setEntries) && exercise.setEntries.length
            ? exercise.setEntries
            : [{ weight: exercise.weight || { type: 'body' }, reps: exercise.reps }];
        setEntries.forEach((set) => {
          const weight = set.weight || exercise.weight || { type: 'body' };
          exerciseMap.get(key).entries.push({
            session,
            exercise,
            weight: total(weight),
            weightType: weight.type,
            reps: Math.max(0, Number(set.reps) || 0),
          });
        });
      });
    });
    const daysAgo = (date) => {
      const day = new Date(date);
      if (Number.isNaN(day.getTime())) return 'Date unknown';
      const today = new Date();
      const days = Math.max(
        0,
        Math.floor(
          (new Date(today.getFullYear(), today.getMonth(), today.getDate()) -
            new Date(day.getFullYear(), day.getMonth(), day.getDate())) /
            86400000,
        ),
      );
      return days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'} ago`;
    };
    const weightText = (entry) =>
      entry.weightType === 'body'
        ? 'Body weight'
        : `${entry.weightType === 'plates' && Number.isInteger(entry.weight) ? entry.weight.toFixed(1) : entry.weight} kg`;
    const entries = [...exerciseMap.values()]
      .map((group) => {
        group.entries.sort((a, b) => new Date(a.session.date) - new Date(b.session.date));
        const record = group.entries.reduce((best, entry) =>
          entry.weight > best.weight ? entry : best,
        );
        return { ...group, record, latest: group.entries.at(-1) };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    app.innerHTML = `<div class="achievements-head"><div><p class="eyebrow">Your progress</p><h1>High Score</h1><p class="muted">Personal records and estimated one-rep maxes from your training history.</p></div></div>${
      entries.length
        ? `<div class="achievement-list">${entries
            .map(({ name, entries: records, record, latest }) => {
              const hasRepeat = records.length > 1;
              const epley = record.weight * (1 + record.reps / 30);
              const brzycki =
                record.reps < 37 ? (record.weight * 36) / (37 - record.reps) : null;
              const estimates =
                record.weightType === 'body'
                  ? '<p class="achievement-note">Body-weight exercises do not have a loaded-weight 1RM estimate.</p>'
                  : `<div class="one-rm-values"><div><span>Epley 1RM</span><b>${epley.toFixed(1)} kg</b></div><div><span>Brzycki 1RM</span><b>${brzycki === null ? '—' : `${brzycki.toFixed(1)} kg`}</b></div></div><p class="achievement-note">Estimated from ${weightText(record)} × ${record.reps} reps.</p>`;
              return `<article class="achievement-card"><div class="achievement-title"><h2>${esc(name)}</h2></div><div class="achievement-record"><span>Highest weight</span><b>${esc(weightText(record))}</b><small>${esc(daysAgo(record.session.date))} · ${record.reps} rep${record.reps === 1 ? '' : 's'}</small></div>${hasRepeat ? `<div class="achievement-latest"><span>Last performed</span><b>${esc(weightText(latest))}</b><small>${esc(daysAgo(latest.session.date))}</small></div>` : ''}${estimates}</article>`;
            })
            .join('')}</div>`
        : '<div class="empty"><div class="empty-icon">🏆</div><b>No achievements yet</b>Your exercise records will appear here after you finish a session.</div>'
    }`;
  }
  function startSession() {
    const date = new Date().toISOString();
    active = {
      id: crypto.randomUUID?.() || String(Date.now()),
      date,
      title: defaultSessionName(date),
      startTime: currentTimeValue(),
      endTime: '',
      exercises: [],
    };
    reorderMode = false;
    renderActive();
  }
  function renderActive() {
    const canReorder = active.exercises.length > 0;
    app.innerHTML = `<div class="session-head"><button class="back" id="back">‹</button><div class="session-heading"><div class="session-name-row"><h1 id="session-name">${esc(active.title)}</h1><button class="session-name-edit" id="edit-session-name" type="button" data-editing="false" aria-label="Edit session name" title="Edit session name">✎</button></div><p>${active.exercises.length} exercises</p></div><button class="secondary session-actions" id="finish">Finish</button></div><div class="split-fields session-time-fields"><div class="field"><label for="session-start-time">Session start</label><input id="session-start-time" class="text-input" type="time" value="${esc(active.startTime || '')}"></div><div class="field"><label for="session-end-time">Session end</label><input id="session-end-time" class="text-input" type="time" value="${esc(active.endTime || '')}"></div></div><div class="section-title"><h2>Exercises</h2><div class="exercise-count-controls"><span>${active.exercises.length} added</span><button class="lock-order" id="reorder" type="button" aria-label="${reorderMode ? 'Unlock exercise order' : 'Lock exercise order'}" title="${reorderMode ? 'Unlock exercise order' : 'Lock exercise order'}" ${canReorder ? '' : 'disabled'}>${reorderMode ? '🔓' : '🔒'}</button>${reorderMode ? '<div class="rotate-controls"><button class="rotate-action" id="rotate-exercises" type="button" aria-label="Move last exercise to the top" title="Move last exercise to the top" ' + (active.exercises.length < 2 ? 'disabled' : '') + '>↻</button><button class="rotate-action" id="rotate-exercises-reverse" type="button" aria-label="Move first exercise to the bottom" title="Move first exercise to the bottom" ' + (active.exercises.length < 2 ? 'disabled' : '') + '>↺</button></div>' : ''}</div></div><div class="exercise-list${reorderMode ? ' is-reordering' : ''}" id="exercise-list">${active.exercises.map((e, i) => `<article class="exercise-card${reorderMode ? ' is-draggable' : ''}" data-exercise-index="${i}"><div class="exercise-row"><span class="drag-handle" aria-hidden="true">⠿</span><div class="exercise-card-head"><div style="flex:1"><h3>${esc(e.name)}</h3>${exerciseNoteHtml(e)}${setSummaryHtml(e)}</div><span class="load-pill">${esc(loadText(e.weight))}</span></div></div><div class="card-controls"><button class="small-action" data-edit="${i}">Edit</button><button class="small-action delete" data-remove="${i}">Remove</button></div></article>`).join('')}</div><div class="exercise-actions"><button class="add-exercise" id="add"><span>＋</span> Add exercise</button><button class="scan-exercises" id="scan-exercises" type="button"><span aria-hidden="true">▦</span> ${canReorder ? 'Show QR' : 'Scan QR'}</button></div>${active.exercises.length ? '<div class="finish-bar"><button class="primary" id="finish-bottom">Finish session &nbsp; →</button></div>' : ''}`;
    validateActiveSessionTimes = bindSessionTimeInputs(active);
    bindSessionName(active, true);
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
            note: null,
            sets: 1,
            reps: 1,
            weight: { type: 'body' },
          }
        : structuredClone(session.exercises[index]);
    ex.note = typeof ex.note === 'string' && ex.note.trim() ? ex.note : null;
    const boundedReps = (value) =>
      Math.min(50, Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 1));
    let recordedSets =
      index === null
        ? []
        : Array.isArray(ex.setEntries)
          ? ex.setEntries.map((set) => ({
              reps: boundedReps(set.reps),
              reps_type: REPS_TYPES.includes(set.reps_type) ? set.reps_type : 'Reps',
              weight: structuredClone(set.weight || ex.weight || { type: 'body' }),
            }))
          : Array.from({ length: Math.max(1, Math.floor(Number(ex.sets) || 1)) }, () => ({
              reps: boundedReps(ex.reps),
              reps_type: 'Reps',
              weight: structuredClone(ex.weight || { type: 'body' }),
            }));
    recordedSets.forEach((set) => {
      if (!REPS_TYPES.includes(set.reps_type)) set.reps_type = 'Reps';
    });
    let selectedSetIndex = -1;
    const initialReps = boundedReps(ex.reps);
    let repsType = recordedSets[0]?.reps_type || 'Reps';
    const returnToSession = () =>
      session === active ? renderActive() : renderSaved(session.id);
    const numberWheel = (
      id,
      label,
      value,
      values = Array.from({ length: 1000 }, (_, number) => number),
      format = (number) => String(number),
    ) => {
      value = values.includes(Number(value)) ? Number(value) : values[0];
      return `<div class="number-wheel" id="${id}" role="spinbutton" tabindex="0" aria-label="${label}" aria-valuemin="${values[0]}" aria-valuemax="${values.at(-1)}" aria-valuenow="${value}" aria-valuetext="${value}" data-value="${value}"><div class="number-wheel-viewport"><div class="number-wheel-list">${values.map((number, index) => `<div class="number-wheel-item${number === value ? ' is-selected' : ''}" data-index="${index}" data-value="${number}" aria-hidden="true">${format(number)}</div>`).join('')}</div></div></div>`;
    };
    const weightTypeIcons = {
      body: 'images/body.png',
      plates: 'images/plates.png',
      barbell: 'images/barbell.png',
      dumbbell: 'images/dumbbell.png',
      kettlebell: 'images/kettlebell.png',
    };
    const nameSaved = index !== null;
    app.innerHTML = `<div class="session-head"><button class="back" id="form-back">‹</button><div><h1>${index === null ? 'Add exercise' : 'Edit exercise'}</h1><p>Build your session one movement at a time</p></div></div><form class="form-card${nameSaved ? ' name-saved' : ''}" id="form"><div class="field"><label for="name">Exercise name</label><div class="exercise-name-row" id="name-container">${nameSaved ? `<span id="name-label" class="locked-exercise-name">${esc(ex.name)}</span>` : `<input id="name" class="text-input" list="exercise-suggestions" value="${esc(ex.name)}" placeholder="e.g. Goblet squat" required maxlength="60" autocomplete="off">`}<button class="name-lock-button" id="toggle-name-lock" type="button" aria-label="${nameSaved ? 'Edit' : 'Save'} exercise name" title="${nameSaved ? 'Edit' : 'Save'} exercise name">${nameSaved ? '✏️' : '💾'}</button><button class="name-lock-button note-button" id="edit-exercise-note" type="button" aria-label="Add exercise note" title="Add exercise note">🗒️</button></div></div><div class="exercise-controls"${nameSaved ? '' : ' hidden'}><div class="field"><span class="field-label">Load type</span><div class="load-selection-row"><div class="weight-types"><label class="weight-option"><input type="radio" name="type" value="body" aria-label="Body" title="Body" ${ex.weight.type === 'body' ? 'checked' : ''}><span><img class="weight-type-icon" src="${weightTypeIcons.body}" alt="" aria-hidden="true"></span></label><label class="weight-option"><input type="radio" name="type" value="plates" aria-label="Plates" title="Plates" ${ex.weight.type === 'plates' ? 'checked' : ''}><span><img class="weight-type-icon" src="${weightTypeIcons.plates}" alt="" aria-hidden="true"></span></label><label class="weight-option"><input type="radio" name="type" value="barbell" aria-label="Barbell" title="Barbell" ${ex.weight.type === 'barbell' ? 'checked' : ''}><span><img class="weight-type-icon" src="${weightTypeIcons.barbell}" alt="" aria-hidden="true"></span></label><label class="weight-option"><input type="radio" name="type" value="dumbbell" aria-label="Dumbbell" title="Dumbbell" ${ex.weight.type === 'dumbbell' ? 'checked' : ''}><span><img class="weight-type-icon" src="${weightTypeIcons.dumbbell}" alt="" aria-hidden="true"></span></label><label class="weight-option"><input type="radio" name="type" value="kettlebell" aria-label="Kettlebell" title="Kettlebell" ${ex.weight.type === 'kettlebell' ? 'checked' : ''}><span><img class="weight-type-icon" src="${weightTypeIcons.kettlebell}" alt="" aria-hidden="true"></span></label></div></div><div class="load-controls-row"><div class="weight-selector-container"><div id="weight-panel" class="weight-panel"></div></div><div class="rep-stamp-control"><div class="rep-wheel-field"><span class="field-label">Number</span>${numberWheel(
      'set-reps',
      'Reps value',
      initialReps,
      Array.from({ length: 51 }, (_, number) => number),
    )}</div><div class="reps-type-field"><span class="field-label">&nbsp;</span><div class="reps-type-wheel" id="reps-type-wheel" role="listbox" aria-label="Reps type" tabindex="0">${REPS_TYPES.map((type) => `<div class="reps-type-option${type === repsType ? ' is-selected' : ''}" data-reps-type="${type}" role="option" aria-selected="${type === repsType}">${type}</div>`).join('')}</div></div><button class="stamp-button" id="record-set" type="button" aria-label="Record set" title="Record set"><img src="images/stamp.png" alt="" aria-hidden="true"></button></div></div></div><div class="sets-field"><span class="field-label">Sets</span><div id="recorded-sets" class="recorded-sets" aria-live="polite"></div></div></div><div class="form-actions"><button type="button" class="secondary" id="cancel">Cancel</button><button class="primary" id="done" ${nameSaved ? '' : 'hidden'}>Done</button></div></form>`;
    const form = $('#form');
    const noteDialog = $('#exercise-note-dialog');
    const noteInput = $('#exercise-note-input');
    let noteDraft = typeof ex.note === 'string' ? ex.note : '';
    $('#edit-exercise-note').onclick = () => {
      noteInput.value = noteDraft;
      noteDialog.showModal();
      noteInput.focus();
    };
    $('#cancel-exercise-note').onclick = () => noteDialog.close();
    $('#exercise-note-form').onsubmit = (event) => {
      event.preventDefault();
      noteDraft = noteInput.value.trim();
      noteDialog.close();
    };
    function updateWeightSuggestions(name = $('#name-label', form)?.textContent || '') {
      const history = $('#exercise-history', form);
      if (history) {
        history.innerHTML = name ? exerciseHistory(name) : '';
        history.hidden = !name;
      }
      const suggestion = $('#suggested-weight', form);
      if (!suggestion) return;
      suggestion.textContent = '';
      suggestion.hidden = true;
      const performances = name ? exercisePerformances(name) : [];
      if (!performances.length) return;
      const record = performances.reduce((best, current) =>
        current.weight >= best.weight ? current : best,
      );
      const latest = performances.at(-1);
      const reps = Number($('#set-reps', form).dataset.value);
      const estimate = (performance) =>
        reps === 0
          ? 0
          : (performance.weight * (1 + performance.reps / 30)) / (1 + reps / 30);
      const suggestions = [
        ...new Set(
          [estimate(record), estimate(latest)].map(
            (value) => Math.round(value * 10) / 10,
          ),
        ),
      ].sort((a, b) => a - b);
      const values = suggestions.map((value) =>
        Number.isInteger(value) ? String(value) : value.toFixed(1),
      );
      suggestion.textContent = `Suggested: ${values.join('-')} kg`;
      suggestion.hidden = false;
    }
    $('#form-back').onclick = returnToSession;
    $('#cancel').onclick = returnToSession;
    $('#toggle-name-lock').onclick = (event) => {
      const button = event.currentTarget;
      const input = $('#name', form);
      if (input) {
        const name = preferredExerciseName(input.value);
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
        updateWeightSuggestions(name);
        form.classList.add('name-saved');
        $('.exercise-controls', form).hidden = false;
        $('#done', form).hidden = false;
        button.textContent = '✏️';
        button.setAttribute('aria-label', 'Edit exercise name');
        button.title = 'Edit exercise name';
      } else {
        const label = $('#name-label', form);
        const editable = document.createElement('input');
        editable.id = 'name';
        editable.className = 'text-input';
        editable.setAttribute('list', 'exercise-suggestions');
        editable.value = preferredExerciseName(label.textContent);
        editable.placeholder = 'e.g. Goblet Squat';
        editable.required = true;
        editable.maxLength = 60;
        editable.autocomplete = 'off';
        label.replaceWith(editable);
        form.classList.remove('name-saved');
        $('.exercise-controls', form).hidden = true;
        $('#done', form).hidden = true;
        $('#exercise-history', form).hidden = true;
        updateWeightSuggestions('');
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
        else if (event.key === 'End') next = values.length - 1;
        else return;
        event.preventDefault();
        viewport.scrollTo({ top: Math.max(0, Math.min(values.length - 1, next)) * 44 });
      });
      requestAnimationFrame(() => {
        viewport.scrollTop = selected * 44;
      });
    }
    setupNumberWheel(
      'set-reps',
      Array.from({ length: 51 }, (_, number) => number),
      () => updateWeightSuggestions(),
    );
    const recordedSetsElement = $('#recorded-sets', form);
    function renderRecordedSets() {
      recordedSetsElement.innerHTML = recordedSets
        .map(
          (set, setIndex) =>
            `<div class="recorded-set${selectedSetIndex === setIndex ? ' is-selected' : ''}" data-set-index="${setIndex}" role="button" tabindex="0" aria-pressed="${selectedSetIndex === setIndex}" aria-label="Set ${setIndex + 1}: ${loadText(set.weight)}, ${set.reps} ${set.reps_type}">${selectedSetIndex === setIndex ? `<button class="set-delete" type="button" data-delete-set="${setIndex}" aria-label="Delete set ${setIndex + 1}" title="Delete set">×</button>` : ''}<b>Set ${setIndex + 1}</b><span>${esc(loadText(set.weight))}</span><small>${set.reps} ${set.reps_type === 'Reps' ? `rep${Number(set.reps) === 1 ? '' : 's'}` : set.reps_type.toLowerCase()}</small></div>`,
        )
        .join('');
    }
    function selectRecordedSet(setIndex) {
      const set = recordedSets[setIndex];
      if (!set) return;
      if (selectedSetIndex === setIndex) {
        selectedSetIndex = -1;
        renderRecordedSets();
        return;
      }
      selectedSetIndex = setIndex;
      selectRepsType(set.reps_type || 'Reps');
      ex.weight = structuredClone(set.weight);
      const radio = $(`input[name="type"][value="${set.weight.type}"]`, form);
      if (radio) radio.checked = true;
      panel();
      const repsWheel = $('#set-reps', form);
      const repsValues = Array.from({ length: 51 }, (_, number) => number);
      const repsValue = repsValues.includes(Number(set.reps)) ? Number(set.reps) : 0;
      repsWheel.dataset.value = String(repsValue);
      repsWheel.setAttribute('aria-valuenow', String(repsValue));
      repsWheel.setAttribute('aria-valuetext', String(repsValue));
      const repsViewport = $('.number-wheel-viewport', repsWheel);
      repsViewport.style.scrollBehavior = 'auto';
      repsViewport.scrollTop = repsValue * 44;
      repsViewport.dispatchEvent(new Event('scroll'));
      repsViewport.style.removeProperty('scroll-behavior');
      renderRecordedSets();
    }
    const repsTypeWheel = $('#reps-type-wheel');
    function selectRepsType(type, scroll = true) {
      if (!REPS_TYPES.includes(type)) return;
      repsType = type;
      const selectedOption = repsTypeWheel.querySelector(`[data-reps-type="${type}"]`);
      form.querySelectorAll('[data-reps-type]').forEach((option) => {
        const selected = option === selectedOption;
        option.classList.toggle('is-selected', selected);
        option.setAttribute('aria-selected', selected);
      });
      if (scroll) selectedOption?.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
    repsTypeWheel.addEventListener('click', (event) => {
      const option = event.target.closest('[data-reps-type]');
      if (option) selectRepsType(option.dataset.repsType);
    });
    repsTypeWheel.addEventListener('keydown', (event) => {
      const currentIndex = REPS_TYPES.indexOf(repsType);
      let nextIndex = currentIndex;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') nextIndex = Math.min(REPS_TYPES.length - 1, currentIndex + 1);
      else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') nextIndex = Math.max(0, currentIndex - 1);
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = REPS_TYPES.length - 1;
      else return;
      event.preventDefault();
      selectRepsType(REPS_TYPES[nextIndex]);
    });
    requestAnimationFrame(() => selectRepsType(repsType));
    recordedSetsElement.addEventListener('click', (event) => {
      const deleteButton = event.target.closest('[data-delete-set]');
      const setCard = event.target.closest('[data-set-index]');
      if (!setCard) return;
      const setIndex = Number(setCard.dataset.setIndex);
      if (deleteButton) {
        event.stopPropagation();
        recordedSets.splice(setIndex, 1);
        if (selectedSetIndex === setIndex) {
          selectedSetIndex = recordedSets.length
            ? Math.min(setIndex, recordedSets.length - 1)
            : -1;
          if (selectedSetIndex >= 0) selectRecordedSet(selectedSetIndex);
        } else if (selectedSetIndex > setIndex) selectedSetIndex -= 1;
        renderRecordedSets();
        return;
      }
      selectRecordedSet(setIndex);
    });
    recordedSetsElement.addEventListener('keydown', (event) => {
      if (
        (event.key === 'Enter' || event.key === ' ') &&
        event.target.matches('[data-set-index]')
      ) {
        event.preventDefault();
      selectRecordedSet(Number(event.target.dataset.setIndex));
      }
    });
    function panel() {
      let t = $('input[name=type]:checked', form).value,
        w = ex.weight,
        p = $('#weight-panel');
      if (t === 'body') {
        p.innerHTML =
          '<div class="total-box" style="border:0;margin:0;padding:0"><span>No external load</span><b>Body</b><div id="exercise-history" class="exercise-history" aria-live="polite" hidden></div><small id="suggested-weight" class="suggested-weight" hidden></small></div>';
        updateWeightSuggestions();
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
        p.innerHTML = `<div class="plates-wheels"><div class="plates-wheel-labels"><span>Whole kg</span><span>Fraction of kg</span></div><div class="plates-wheel-columns"><div class="plates-wheel-column">${numberWheel('plate-integer', 'Whole kilograms', integer, integerValues)}</div><div class="plates-wheel-column">${numberWheel('plate-fraction', 'Fractional kilograms', fraction, fractionValues, (value) => String(value))}</div></div></div><div class="total-box"><span>Total plates weight</span><b id="plates-total">${formatPlateWeight(initialTotal)} kg</b><div id="exercise-history" class="exercise-history" aria-live="polite" hidden></div><small id="suggested-weight" class="suggested-weight" hidden></small></div>`;
        const updatePlatesTotal = () => {
          const amount =
            Number($('#plate-integer', form).dataset.value) +
            Number($('#plate-fraction', form).dataset.value);
          $('#plates-total').textContent = `${formatPlateWeight(amount)} kg`;
        };
        setupNumberWheel('plate-integer', integerValues, updatePlatesTotal);
        setupNumberWheel('plate-fraction', fractionValues, updatePlatesTotal);
      } else if (t === 'barbell') {
        let bar = w.type === 'barbell' ? w.bar : 0,
          plates = barbellPlateCounts(w);
        p.innerHTML = `<div class="weight-row"><span class="weight-row-label">Bar weight</span><div class="choice-toggle" role="group" aria-label="Bar weight"><button type="button" data-bar="0" aria-label="Zero bar weight" aria-pressed="${bar === 0}">−</button><button type="button" data-bar="15" aria-pressed="${bar === 15}">15 kg</button><button type="button" data-bar="20" aria-pressed="${bar === 20}">20 kg</button></div></div><div class="barbell-plates"><div class="barbell-plates-head"><span class="weight-row-label" id="barbell-plate-label">${bar === 0 ? 'Plates for one hand' : 'Plates per side'}</span><button class="small-action" id="clear-barbell-plates" type="button">Clear all</button></div><div class="barbell-plate-grid" id="barbell-plate-grid" role="group" aria-label="Plate counts per side">${BARBELL_PLATES.map((kg) => `<div class="barbell-plate" data-plate="${kg}"><span class="barbell-plate-label">${kg}</span><div class="barbell-plate-controls"><button type="button" data-plate-step="1" aria-label="Add one ${kg} kilogram plate">＋</button><output data-plate-count>${plates[String(kg)]}</output><button type="button" data-plate-step="-1" aria-label="Remove one ${kg} kilogram plate">−</button></div></div>`).join('')}</div></div><div class="total-box"><span>Total barbell weight</span><b id="total" aria-live="polite">${bar === 0 ? barbellPerSide({ plates }) : bar + 2 * barbellPerSide({ plates })} kg</b><div id="exercise-history" class="exercise-history" aria-live="polite" hidden></div><small id="suggested-weight" class="suggested-weight" hidden></small></div>`;
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
          0, 1.25, 2.5, 4, 5, 6, 7, 8, 9, 10, 12.5, 15, 17.5, 20, 22.5, 25,
        ];
        let count = w.type === 'dumbbell' ? w.count : 2,
          each = w.type === 'dumbbell' ? w.each : 0;
        if (!eachValues.includes(each)) {
          each = eachValues.reduce((closest, value) =>
            Math.abs(value - each) < Math.abs(closest - each) ? value : closest,
          );
        }
        p.innerHTML = `<div class="weight-row"><span class="weight-row-label">Dumbbells</span><div class="choice-toggle" role="group" aria-label="Number of dumbbells"><button type="button" data-count="1" aria-pressed="${count === 1}">1</button><button type="button" data-count="2" aria-pressed="${count === 2}">2</button></div></div><div class="plates-wheels single-weight-wheel"><div class="plates-wheel-labels"><span>Each (kg)</span></div><div class="plates-wheel-columns"><div class="plates-wheel-column">${numberWheel('each', 'Weight of each dumbbell', each, eachValues, (value) => String(value))}</div></div></div><div class="total-box"><span>Total dumbbell weight</span><b id="total">${count * each} kg</b><div id="exercise-history" class="exercise-history" aria-live="polite" hidden></div><small id="suggested-weight" class="suggested-weight" hidden></small></div>`;
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
        let kg = w.type === 'kettlebell' ? w.kg : 12;
        let count = w.type === 'kettlebell' ? w.count || 1 : 1;
        const kettlebellColors = {
          12: 'light-blue',
          16: 'yellow',
          20: 'purple',
          24: 'green',
          28: 'orange',
        };
        p.innerHTML = `<div class="kettlebell-options" role="group" aria-label="Kettlebell weight">${[12, 16, 20, 24, 28].map((n) => `<button class="kettlebell-option kettlebell-${kettlebellColors[n]}" type="button" data-kg="${n}" aria-label="${n} kilograms" aria-pressed="${n === kg}"><svg class="kettlebell-icon" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path class="kettlebell-handle" d="M23 23v-7a9 9 0 0 1 18 0v7"/><path class="kettlebell-body" d="M23 21h18l3 5c7 4 11 11 11 19 0 11-9 17-23 17S9 56 9 45c0-8 4-15 11-19l3-5Z"/><path class="kettlebell-highlight" d="M20 35c-3 3-5 7-5 11"/></svg><span class="kettlebell-weight">${n}</span></button>`).join('')}</div><div class="weight-row"><span class="weight-row-label">Kettlebells</span><div class="choice-toggle" role="group" aria-label="Number of kettlebells"><button type="button" data-count="1" aria-pressed="${count === 1}">1</button><button type="button" data-count="2" aria-pressed="${count === 2}">2</button></div></div><div class="total-box"><span>Total kettlebell weight</span><b id="total">${count * kg} kg</b><div id="exercise-history" class="exercise-history" aria-live="polite" hidden></div><small id="suggested-weight" class="suggested-weight" hidden></small></div>`;
        const updateKettlebellTotal = () => {
          const selectedKg = Number(
            p.querySelector('[data-kg][aria-pressed="true"]').dataset.kg,
          );
          const selectedCount = Number(
            p.querySelector('[data-count][aria-pressed="true"]').dataset.count,
          );
          $('#total').textContent = `${selectedCount * selectedKg} kg`;
        };
        p.querySelectorAll('[data-count]').forEach((button) => {
          button.onclick = () => {
            p.querySelectorAll('[data-count]').forEach((option) =>
              option.setAttribute('aria-pressed', option === button),
            );
            updateKettlebellTotal();
          };
        });
        p.querySelectorAll('[data-kg]').forEach((button) => {
          button.onclick = () => {
            p.querySelectorAll('[data-kg]').forEach((option) =>
              option.setAttribute('aria-pressed', option === button),
            );
            updateKettlebellTotal();
          };
        });
      }
      updateWeightSuggestions();
    }
    form.querySelectorAll('[name=type]').forEach((r) => (r.onchange = panel));
    panel();
    renderRecordedSets();
    function readWeight() {
      let t = $('input[name=type]:checked', form).value;
      return t === 'barbell'
        ? {
            type: t,
            bar: +$('.choice-toggle [aria-pressed="true"]', form).dataset.bar,
            side: barbellPerSide({
              plates: readBarbellPlateCounts($('#weight-panel', form)),
            }),
            plates: readBarbellPlateCounts($('#weight-panel', form)),
          }
        : t === 'dumbbell'
          ? {
              type: t,
              count: +$('.choice-toggle [aria-pressed="true"]', form).dataset.count,
              each: +$('#each', form).dataset.value,
            }
          : t === 'kettlebell'
            ? {
                type: t,
                kg: +$('#weight-panel [data-kg][aria-pressed="true"]').dataset.kg,
                count: +$('#weight-panel [data-count][aria-pressed="true"]').dataset
                  .count,
              }
            : t === 'plates'
              ? {
                  type: t,
                  integer: Number($('#plate-integer', form).dataset.value),
                  fraction: Number($('#plate-fraction', form).dataset.value),
                }
              : { type: 'body' };
    }
    $('#record-set', form).onclick = () => {
      const entry = {
        reps: Number($('#set-reps', form).dataset.value),
        reps_type: repsType,
        weight: readWeight(),
      };
      const stampedIndex = selectedSetIndex >= 0 ? selectedSetIndex : recordedSets.length;
      if (selectedSetIndex >= 0) recordedSets[selectedSetIndex] = entry;
      else recordedSets.push(entry);
      ex.weight = structuredClone(entry.weight);
      selectedSetIndex = -1;
      renderRecordedSets();
      recordedSetsElement
        .querySelector(`[data-set-index="${stampedIndex}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const weight = structuredClone(recordedSets.at(-1)?.weight ?? readWeight());
      const name = preferredExerciseName(
        $('#name', form)?.value ?? $('#name-label', form)?.textContent ?? '',
      );
      let result = {
        name,
        note: noteDraft.trim() || null,
        sets: recordedSets.length,
        reps: recordedSets.at(-1)?.reps ?? Number($('#set-reps', form).dataset.value),
        reps_type: recordedSets.at(-1)?.reps_type ?? repsType,
        weight,
        setEntries: recordedSets,
      };
      if (index === null) session.exercises.push(result);
      else session.exercises[index] = result;
      if (
        !data.names.some((n) => normalizeExerciseName(n) === normalizeExerciseName(name))
      )
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
            const names = [
              ...new Map(
                parsed.map((name) => {
                  const preferred = preferredExerciseName(name);
                  return [normalizeExerciseName(preferred), preferred];
                }),
              ).values(),
            ];
            if (!names.length) throw new Error('The QR code does not contain any names.');
            for (const name of names) {
              if (
                !data.names.some(
                  (savedName) =>
                    normalizeExerciseName(savedName) === normalizeExerciseName(name),
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
    app.innerHTML = `<div class="session-head"><button class="back" id="saved-back">‹</button><div class="session-heading"><div class="session-name-row"><h1 id="session-name">${esc(s.title)}</h1><button class="session-name-edit" id="edit-session-name" type="button" data-editing="false" aria-label="Edit session name" title="Edit session name">✎</button></div><p>${new Date(s.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p></div><button class="small-action delete session-actions" id="delete">Delete</button></div><div class="split-fields session-time-fields"><div class="field"><label for="session-start-time">Session start</label><input id="session-start-time" class="text-input" type="time" value="${esc(s.startTime || '')}"></div><div class="field"><label for="session-end-time">Session end</label><input id="session-end-time" class="text-input" type="time" value="${esc(s.endTime || '')}"></div></div><div class="summary-card"><p>Session summary</p><b>${s.exercises.length} exercises</b><p>Logged ${new Date(s.date).toLocaleDateString()}</p></div><button class="scan-exercises saved-show-qr" id="saved-show-qr" type="button"><span aria-hidden="true">▦</span> Show QR</button><div class="exercise-list">${s.exercises.map((e, i) => `<article class="exercise-card"><div class="exercise-card-head"><div style="flex:1"><h3>${esc(e.name)}</h3>${exerciseNoteHtml(e)}${setSummaryHtml(e)}</div><span class="load-pill">${esc(loadText(e.weight))}</span></div><div class="card-controls"><button class="small-action" data-saved-edit="${i}">Edit</button></div></article>`).join('')}</div>`;
    bindSessionTimeInputs(s);
    bindSessionName(s, false);
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
    // A fresh visit should land on the training history. Keep explicit routes
    // intact, and normalize only an empty fragment to the history route.
    if (!location.hash) {
      location.replace(`${location.pathname}${location.search}#home`);
      return;
    }
    let m = location.hash.match(/^#session\/([^/]+)$/);
    if (m) renderSaved(decodeURIComponent(m[1]));
    else if (location.hash === '#achievements') renderAchievements();
    else if (location.hash === '#home' || location.hash === '#history') renderHome();
    else startSession();
  }
  const dialog = $('#data-dialog');
  function backupJson() {
    return JSON.stringify({ format: 'form-training-log', version: 1, ...data }, null, 2);
  }
  $('#menu-button').onclick = () => {
    dialog.showModal();
    $('#dialog-status').textContent = '';
  };
  $('#refresh-app').onclick = async () => {
    const status = $('#dialog-status');
    const button = $('#refresh-app');
    button.disabled = true;
    status.textContent = 'Checking for updates…';
    try {
      if (!('serviceWorker' in navigator)) {
        location.reload();
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        location.reload();
        return;
      }
      await registration.update();
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        await new Promise((resolve) => {
          navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
        });
        location.reload();
        return;
      }
      if (registration.installing) {
        await new Promise((resolve) => {
          const worker = registration.installing;
          if (worker.state === 'activated') return resolve();
          worker.addEventListener('statechange', () => {
            if (worker.state === 'activated' || worker.state === 'redundant') resolve();
          });
        });
        if (navigator.serviceWorker.controller) {
          location.reload();
          return;
        }
      }
      location.reload();
    } catch (error) {
      status.textContent = error.message || 'Could not check for updates. Try again online.';
      button.disabled = false;
    }
  };
  $('#close-dialog').onclick = () => dialog.close();
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  function importBackupText(text) {
    const objectStart = text.indexOf('{');
    if (objectStart < 0) throw new Error('This does not look like a valid fit24 backup.');
    const parsed = JSON.parse(text.slice(objectStart));
    if (
      !parsed ||
      !Array.isArray(parsed.sessions) ||
      parsed.sessions.some(
        (session) =>
          !session ||
          typeof session !== 'object' ||
          !Array.isArray(session.exercises) ||
          session.exercises.some((exercise) => !exercise || typeof exercise !== 'object'),
      ) ||
      (parsed.names !== undefined &&
        (!Array.isArray(parsed.names) ||
          parsed.names.some((name) => typeof name !== 'string')))
    )
      throw new Error('This does not look like a valid fit24 backup.');
    const importedSessions = parsed.sessions.map(migrateSession);
    data.sessions = importedSessions;
    data.names = [
      ...new Map(
        [
          ...STANDARD_EXERCISES,
          ...data.names,
          ...(parsed.names || []),
          ...importedSessions.flatMap((session) =>
            session.exercises.map((exercise) => exercise.name).filter(Boolean),
          ),
        ].map((name) => {
          const preferred = preferredExerciseName(name);
          return [normalizeExerciseName(preferred), preferred];
        }),
      ).values(),
    ];
    save();
    $('#dialog-status').textContent = `Imported ${importedSessions.length} sessions.`;
    renderHome();
  }
  $('#export-json').onclick = async () => {
    const filename = `fit24-training-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([backupJson()], { type: 'application/json' });
    const file =
      typeof File === 'undefined'
        ? null
        : new File([blob], filename, { type: blob.type });
    if (file && navigator.canShare?.({ files: [file] }) && navigator.share) {
      try {
        await navigator.share({ files: [file], title: 'fit24 training backup' });
        $('#dialog-status').textContent = 'Backup shared or saved.';
      } catch (error) {
        if (error.name !== 'AbortError')
          $('#dialog-status').textContent =
            error.message || 'Could not share the backup.';
      }
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('#dialog-status').textContent = 'Backup file saved.';
  };
  $('#import-file').onchange = async (e) => {
    try {
      if (e.target.files[0]) importBackupText(await e.target.files[0].text());
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
      $('#dialog-status').textContent =
        'Clipboard access was denied. Allow access and try again.';
    }
  };
  $('#paste-json').onclick = async () => {
    try {
      if (!navigator.clipboard?.readText)
        throw new Error('Clipboard reading is not available in this browser.');
      const text = await navigator.clipboard.readText();
      if (!text.trim()) throw new Error('The clipboard is empty.');
      importBackupText(text);
    } catch (error) {
      $('#dialog-status').textContent =
        error.name === 'NotAllowedError'
          ? 'Clipboard access was denied. Allow access and try again.'
          : error.message || 'Could not read a valid backup from the clipboard.';
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
  function updateNames() {
    if ($('#exercise-suggestions'))
      $('#exercise-suggestions').innerHTML = [
        ...new Map(
          [...STANDARD_EXERCISES, ...data.names].map((name) => {
            const preferred = preferredExerciseName(name);
            return [normalizeExerciseName(preferred), preferred];
          }),
        ).values(),
      ]
        .map((name) => `<option value="${esc(name)}">`)
        .join('');
    const input = $('#name');
    if (input && !input.dataset.normalizationBound) {
      const normalizeExactMatch = () => {
        const value = input.value;
        if (value) input.value = preferredExerciseName(value);
      };
      input.addEventListener('change', normalizeExactMatch);
      input.addEventListener('blur', normalizeExactMatch);
      input.dataset.normalizationBound = 'true';
    }
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
  const splash = $('#splash-screen');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      splash.classList.add('is-hiding');
      splash.addEventListener('transitionend', () => splash.remove(), { once: true });
      setTimeout(() => splash.remove(), 400);
    });
  });
})();
