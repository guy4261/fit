(() => {
  const reps = document.querySelector('#epley-reps');
  const weight = document.querySelector('#epley-weight');
  const result = document.querySelector('#epley-result');
  const chart = document.querySelector('#epley-chart');
  const status = document.querySelector('#epley-status');
  const format = (value) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const tooltip = document.querySelector('#epley-tooltip');
  let drag = null;
  let frame = null;
  let suppressClick = false;
  let clickedReps = null;
  let tooltipReps = null;
  let scale = 80;
  const closeTooltip = () => {
    tooltip.hidden = true;
    tooltipReps = null;
  };
  function render() {
    closeTooltip();
    const r = reps.valueAsNumber;
    const w = weight.valueAsNumber;
    const max = r === 1 ? w : w * (1 + r / 30);
    const valid =
      Number.isInteger(r) && r >= 1 && r <= 25 && w > 0 && Number.isFinite(max);
    result.hidden = !valid;
    status.hidden = valid;
    if (!valid) {
      chart.replaceChildren();
      return;
    }
    scale = drag ? drag.scale : max;
    const points = Array.from({ length: 25 }, (_, i) => {
      const count = i + 1;
      return { reps: count, weight: count === 1 ? max : max / (1 + count / 30) };
    });
    const x = (count) => 88 + ((count - 1) / 24) * 524;
    const y = (load) => 330 - (load / scale) * 270;
    document.querySelector('#epley-summary').textContent =
      `Estimated 1RM: ${format(max)} kg \u00b7 Your set: ${r} reps \u00d7 ${format(w)} kg`;
    const grid = [0, 0.25, 0.5, 0.75, 1]
      .map((fraction) => {
        const height = y(scale * fraction);
        return `<line class="epley-grid" x1="88" y1="${height}" x2="612" y2="${height}"/><text x="78" y="${height + 5}" text-anchor="end">${format(scale * fraction)}</text>`;
      })
      .join('');
    chart.innerHTML = `<title id="epley-chart-title">Weight by repetitions</title><desc id="epley-chart-description">Epley estimates for 1 to 25 repetitions. Estimated 1RM ${format(max)} kilograms. Entered set ${r} repetitions at ${format(w)} kilograms.</desc>${grid}
      <path class="epley-axis" d="M88 50V330H612"/>
      ${[1, 5, 10, 15, 20, 25].map((count) => `<text x="${x(count)}" y="353" text-anchor="middle">${count}</text>`).join('')}
      <text x="350" y="388" text-anchor="middle">Repetitions</text><text transform="translate(20 190) rotate(-90)" text-anchor="middle">Weight (kg)</text>
      <polyline class="epley-curve" points="${points.map((point) => `${x(point.reps)},${y(point.weight)}`).join(' ')}"/>
      ${points.map((point) => `<g class="epley-target${point.reps === r ? ' is-entered' : ''}" data-reps="${point.reps}" data-weight="${point.weight}" role="button" tabindex="0" aria-label="${point.reps} repetitions, ${format(point.weight)} kilograms${point.reps === r ? ', drag to change your set' : ''}"><title>${point.reps} reps: ${format(point.weight)} kg</title><circle class="epley-point${point.reps === r ? ' is-entered' : ''}" cx="${x(point.reps)}" cy="${y(point.weight)}" r="${point.reps === r ? 7 : 3}"/><circle class="epley-hit" cx="${x(point.reps)}" cy="${y(point.weight)}" r="12"/></g>`).join('')}`;
  }
  function showTooltip(target) {
    if (!tooltip.hidden && tooltipReps === target.dataset.reps) {
      closeTooltip();
      return;
    }
    const point = target.querySelector('.epley-point');
    const matrix = chart.getScreenCTM();
    if (!matrix) return;
    const location = new DOMPoint(
      Number(point.getAttribute('cx')),
      Number(point.getAttribute('cy')),
    ).matrixTransform(matrix);
    const bounds = chart.parentElement.getBoundingClientRect();
    tooltip.textContent = `${target.dataset.reps} reps \u00d7 ${format(Number(target.dataset.weight))} kg`;
    tooltip.hidden = false;
    tooltipReps = target.dataset.reps;
    const halfWidth = tooltip.offsetWidth / 2;
    tooltip.style.left = `${Math.max(halfWidth, Math.min(bounds.width - halfWidth, location.x - bounds.left))}px`;
    tooltip.style.top = `${Math.max(0, location.y - bounds.top - tooltip.offsetHeight - 12)}px`;
  }
  document.addEventListener('click', (event) => {
    if (suppressClick) {
      suppressClick = false;
      closeTooltip();
      return;
    }
    const target =
      event.target.closest('#epley-chart .epley-target') ||
      (clickedReps !== null ? chart.querySelector(`[data-reps="${clickedReps}"]`) : null);
    clickedReps = null;
    if (target) showTooltip(target);
    else closeTooltip();
  });
  chart.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      const target = event.target.closest('.epley-target');
      if (target) {
        event.preventDefault();
        showTooltip(target);
      }
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeTooltip();
  });
  chart.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('.epley-target.is-entered') || event.button !== 0) return;
    suppressClick = false;
    drag = {
      id: event.pointerId,
      scale,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
    chart.setPointerCapture(event.pointerId);
  });
  function updateDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 4)
      return;
    closeTooltip();
    drag.moved = true;
    setSelect.value = '';
    historyStatus.hidden = true;
    const matrix = chart.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse(),
    );
    reps.value = Math.max(1, Math.min(25, Math.round(1 + ((point.x - 88) / 524) * 24)));
    weight.value = Math.max(
      0.01,
      Math.round(
        ((330 - Math.max(60, Math.min(329.96625, point.y))) / 270) * drag.scale * 100,
      ) / 100,
    );
    if (frame === null)
      frame = requestAnimationFrame(() => {
        frame = null;
        render();
      });
  }
  chart.addEventListener('pointermove', updateDrag);
  function endDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    if (event.type === 'pointerup') updateDrag(event);
    const moved = drag.moved;
    clickedReps = !moved && event.type === 'pointerup' ? Number(reps.value) : null;
    suppressClick = moved;
    drag = null;
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
    if (moved) render();
    if (chart.hasPointerCapture(event.pointerId))
      chart.releasePointerCapture(event.pointerId);
  }
  chart.addEventListener('pointerup', endDrag);
  chart.addEventListener('pointercancel', endDrag);
  chart.addEventListener('lostpointercapture', endDrag);
  const exerciseSelect = document.querySelector('#epley-exercise');
  const setSelect = document.querySelector('#epley-set');
  const historyStatus = document.querySelector('#epley-history-status');
  const history = new Map();
  let selectedSets = [];
  function totalWeight(load) {
    if (!load || load.type === 'body') return null;
    if (load.type === 'plates') return Number(load.integer) + Number(load.fraction);
    if (load.type === 'dumbbell') return Number(load.count) * Number(load.each);
    if (load.type === 'kettlebell') return Number(load.count || 1) * Number(load.kg);
    if (load.type === 'barbell') {
      const side =
        load.plates && typeof load.plates === 'object'
          ? [1.25, 2.5, 5, 10, 15, 20].reduce(
              (sum, kg) =>
                sum + kg * Math.max(0, Math.floor(Number(load.plates[String(kg)]) || 0)),
              0,
            )
          : Number(load.side) || 0;
      return Number(load.bar) === 0 ? side : Number(load.bar) + 2 * side;
    }
    return null;
  }
  try {
    const stored = JSON.parse(localStorage.getItem('form-training-log-v1') || '{}');
    const sessions = Array.isArray(stored.sessions) ? stored.sessions : [];
    [...sessions]
      .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))
      .forEach((session) => {
        [...(session.exercises || [])].reverse().forEach((exercise) => {
          const name = String(exercise.name || '').trim();
          if (!name) return;
          const key = name.toLocaleLowerCase();
          const sets = Array.isArray(exercise.setEntries)
            ? exercise.setEntries
            : Array.from(
                { length: Math.max(1, Math.floor(Number(exercise.sets) || 1)) },
                () => exercise,
              );
          [...sets.entries()].reverse().forEach(([index, set]) => {
            const load = set.weight || exercise.weight;
            if (!load || load.type === 'body') return;
            if (!history.has(key)) history.set(key, { name, sets: [] });
            history.get(key).sets.push({
              reps: Number(set.reps ?? exercise.reps),
              type: set.reps_type || exercise.reps_type || 'Reps',
              weight: totalWeight(load),
              body: load?.type === 'body',
              index: index + 1,
              date: session.date,
              session: session.title || 'Training session',
            });
          });
        });
      });
  } catch {
    historyStatus.textContent =
      'Training history could not be loaded. You can still enter a set below.';
    historyStatus.hidden = false;
  }
  [...history.entries()]
    .sort((a, b) => a[1].name.localeCompare(b[1].name))
    .forEach(([key, exercise]) => {
      exerciseSelect.add(new Option(exercise.name, key));
    });
  if (!history.size && historyStatus.hidden) {
    historyStatus.textContent =
      'No weighted sets in your training history yet. Enter a set below to explore.';
    historyStatus.hidden = false;
  }
  exerciseSelect.addEventListener('change', () => {
    selectedSets = history.get(exerciseSelect.value)?.sets || [];
    setSelect.replaceChildren(
      new Option(selectedSets.length ? 'Choose a set' : 'Choose an exercise first', ''),
    );
    setSelect.disabled = !selectedSets.length;
    historyStatus.hidden = true;
    selectedSets.forEach((set, index) => {
      const date = new Date(set.date);
      const dateText = Number.isFinite(date.getTime())
        ? date.toLocaleDateString()
        : 'Unknown date';
      const loadText = set.body
        ? 'Body weight'
        : Number.isFinite(set.weight) && set.weight !== null
          ? `${format(set.weight)} kg`
          : 'Unknown weight';
      setSelect.add(
        new Option(
          `${dateText} · ${set.session} · Set ${set.index}: ${set.reps} ${set.type.toLowerCase()} × ${loadText}`,
          String(index),
        ),
      );
    });
  });
  setSelect.addEventListener('change', () => {
    historyStatus.hidden = true;
    if (setSelect.value === '') return;
    const set = selectedSets[Number(setSelect.value)];
    reps.value = set.reps;
    weight.value = set.weight === null || !Number.isFinite(set.weight) ? '' : set.weight;
    render();
    if (
      set.type === 'Seconds' ||
      set.body ||
      !(set.weight > 0) ||
      !Number.isInteger(set.reps) ||
      set.reps < 1 ||
      set.reps > 25
    ) {
      result.hidden = true;
      historyStatus.textContent =
        set.type === 'Seconds'
          ? 'This set was timed in seconds. Enter repetitions below to use Epley.'
          : set.body
            ? 'This set records body weight without a kilogram value. Enter the weight below to analyse it.'
            : 'Epley analysis needs 1–25 repetitions and a weight greater than zero. Adjust the values below to analyse a set.';
      historyStatus.hidden = false;
    }
  });
  function manualInput() {
    setSelect.value = '';
    historyStatus.hidden = true;
    render();
  }
  reps.addEventListener('input', manualInput);
  weight.addEventListener('input', manualInput);
  render();
})();
