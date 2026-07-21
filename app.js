// Adaugă la începutul fișierului app.js
var api = window.focusAPI || {
  get: async (key) => JSON.parse(localStorage.getItem(key) || 'null'),
  set: async (key, val) => localStorage.setItem(key, JSON.stringify(val)),
  delete: async (key) => localStorage.removeItem(key),
  close: () => console.log('Close (Web Mock)'),
  minimize: () => console.log('Minimize (Web Mock)'),
  togglePin: () => console.log('Pin toggled (Web Mock)')
};

document.addEventListener('DOMContentLoaded', async () => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // ─── Constants ────────────────────────────────────────────────────────────────

  const DATA_KEY = 'focushub-data';

  const CATEGORIES = [
    'Facultate', 'Hobby-uri', 'Casnic', 'Dezvoltare Personală',
    'Activitate Fizică', 'Proiecte Personale', 'Socializare', 'Deep Work', 'Quick Wins',
  ];

  const CATEGORY_COLORS = {
    Facultate: '#c4b5fd', 'Hobby-uri': '#f9a8c9', Casnic: '#fdba74',
    'Dezvoltare Personală': '#93c5fd', 'Activitate Fizică': '#6ee7b7',
    'Proiecte Personale': '#a5b4fc', Socializare: '#f0abfc',
    'Deep Work': '#818cf8', 'Quick Wins': '#fda4af',
  };

  const NODE_COLORS = ['#c4b5fd', '#f9a8c9', '#fdba74', '#93c5fd', '#6ee7b7', '#a5b4fc', '#f0abfc', '#fda4af'];
  const NODE_W = 130;
  const NODE_H = 44;
  const NODE_R = 10;

  const ENERGY_WEIGHT = { high: 3, medium: 2, low: 1 };
  const ENERGY_BADGE  = { high: '⚡ High', medium: '◎ Medium', low: '○ Low' };
  const WISH_ICONS    = { books: '📚', courses: '🎓', skills: '⚡', travel: '✈️', other: '💡' };

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  const make = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };

  const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const todayKey = (date = new Date()) => date.toISOString().slice(0, 10);

  const formatDuration = (minutes) => {
    const total = Math.max(0, Number(minutes) || 0);
    if (total < 60) return `${total}m`;
    return `${Math.floor(total / 60)}h ${total % 60}m`;
  };

  const getCountdown = (deadline) => {
    if (!deadline) return { text: 'Fără deadline', state: 'safe', timestamp: '' };
    const diff = new Date(deadline).getTime() - Date.now();
    if (Number.isNaN(diff)) return { text: 'Deadline invalid', state: 'danger', timestamp: '' };
    const time = new Date(deadline).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
    if (diff <= 0) return { text: 'Depășit', state: 'danger', timestamp: time };
    const minutes = Math.ceil(diff / 60000);
    if (minutes < 60)  return { text: `${minutes}m rămas`,                             state: 'danger', timestamp: time };
    const hours = Math.floor(minutes / 60);
    const rest  = minutes % 60;
    if (minutes < 180) return { text: `${hours}h ${rest}m rămas`,                      state: 'warn',   timestamp: time };
    if (hours < 24)    return { text: `${hours}h ${rest}m rămas`,                      state: 'safe',   timestamp: time };
    return               { text: `${Math.ceil(hours / 24)} zile rămase`,               state: 'safe',   timestamp: time };
  };

  const showToast = (message, type = 'success') => {
    const el = make('div', `toast ${type}`, message);
    $('#toast-container').appendChild(el);
    setTimeout(() => el.remove(), 3000);
  };

  // FIX: replace confirm() — blocked in Electron — with a custom inline confirm toast
  const confirmAction = (message, onConfirm) => {
    const container = $('#toast-container');
    const el = make('div', 'toast warn');
    el.style.cssText = 'display:flex;flex-direction:column;gap:8px;pointer-events:all;';
    el.appendChild(make('span', '', message));
    const btns = make('div', '', '');
    btns.style.cssText = 'display:flex;gap:8px;';
    const yes = make('button', 'btn-save', 'Da, șterge');
    yes.style.cssText = 'padding:5px 10px;font-size:12px;';
    const no  = make('button', 'btn-cancel', 'Nu');
    no.style.cssText  = 'padding:5px 10px;font-size:12px;';
    yes.addEventListener('click', () => { el.remove(); onConfirm(); });
    no.addEventListener('click',  () => el.remove());
    btns.append(yes, no);
    el.appendChild(btns);
    container.appendChild(el);
    setTimeout(() => el.isConnected && el.remove(), 8000);
  };

  const playSparkle = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ac = new Ctx();
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.0001, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.04,   ac.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.28);
      gain.connect(ac.destination);
      [988, 1319, 1760].forEach((freq, i) => {
        const osc = ac.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gain);
        osc.start(ac.currentTime + i * 0.045);
        osc.stop(ac.currentTime + 0.20 + i * 0.045);
      });
    } catch { /* audio optional */ }
  };

  const emptyState = (msg, detail = '') => {
    const el = make('div', 'empty-hint');
    el.appendChild(make('div', 'empty-icon', '✦'));
    el.appendChild(make('strong', '', msg));
    if (detail) el.appendChild(make('span', '', detail));
    return el;
  };

  // ─── Data ─────────────────────────────────────────────────────────────────────

  const defaultData = () => ({
    version: 2,
    tasks: [],
    wishes: [],
    scratchpad: '',
    quotes: [{ id: uid(), text: 'Puțin făcut cu blândețe este tot progres.', author: 'FocusHub' }],
    collapsedCategories: {},
    collapsedTasks: {},
    mapNodes: [],
  });

  const loadData = async () => {
    const current = await api.get(DATA_KEY);
    if (current?.version === 2) {
      if (!Array.isArray(current.mapNodes)) current.mapNodes = [];
      return current;
    }
    // Migrate from legacy keys
    const data = defaultData();
    const oldTasks     = (await api.get('focushub-tasks'))     || [];
    const oldWishes    = (await api.get('focushub-wishes'))    || [];
    const oldQuotes    = (await api.get('focushub-quotes'))    || [];
    const oldScratch   = (await api.get('focushub-scratchpad'))|| '';
    data.tasks   = oldTasks.map((t) => ({
      id: uid(), title: t.text || 'Task', description: '', subtasks: [],
      deadline: t.deadline || '', energy: t.priority === 'high' ? 'high' : t.priority === 'low' ? 'low' : 'medium',
      category: 'Quick Wins', minutes: 30, done: Boolean(t.done), createdAt: new Date().toISOString(),
    }));
    data.wishes  = oldWishes.map((w) => ({ id: uid(), ...w }));
    data.quotes  = oldQuotes.length ? oldQuotes.map((q) => ({ id: uid(), ...q })) : data.quotes;
    data.scratchpad = oldScratch;
    await api.set(DATA_KEY, data);
    return data;
  };

  let data = await loadData();
  const saveData = () => api.set(DATA_KEY, data);

  // ─── Task helpers ─────────────────────────────────────────────────────────────

const isTodayTask = (t) => {
  if (!t.deadline) return true;
  return t.deadline.slice(0, 10) >= todayKey();
};
  const isTaskDone    = (t) => t.done || (t.subtasks.length > 0 && t.subtasks.every((s) => s.done));
  const taskSubPct    = (t) => {
    if (!t.subtasks.length) return isTaskDone(t) ? 1 : 0;
    return t.subtasks.filter((s) => s.done).length / t.subtasks.length;
  };

  const sortedTasks = (tasks) => {
    const boost = new Date().getHours() < 12 ? 1.6 : 1;
    return [...tasks].sort((a, b) => {
      if (a.category === b.category) {
        const orderDiff = (a.order ?? 0) - (b.order ?? 0);
        if (orderDiff !== 0) return orderDiff;
      }
      const aT = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
      const bT = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
      return (aT - ENERGY_WEIGHT[a.energy] * boost * 36e5) - (bT - ENERGY_WEIGHT[b.energy] * boost * 36e5);
    });
  };

  const calculateStreak = () => {
    const days = new Set(
      data.tasks.filter(isTaskDone)
        .map((t) => (t.deadline || t.createdAt || '').slice(0, 10))
        .filter(Boolean)
    );
    let streak = 0;
    const cursor = new Date();
    while (days.has(todayKey(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
    return streak;
  };

  // ─── State ────────────────────────────────────────────────────────────────────

  let activeWishCategory = 'all';
  let pendingWishId      = null;
  let editingTaskId      = null;
  let activeQuoteId      = null;

  // ─── Date / greeting ─────────────────────────────────────────────────────────

  const now = new Date();
  $('#date-today').textContent    = now.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#date-greeting').textContent = now.getHours() < 12
    ? 'Bună dimineața, începe cu energia ta bună.'
    : 'Alege următorul pas blând.';

  // Populate task-category <select>
  CATEGORIES.forEach((cat) => {
    const opt = make('option', '', cat);
    opt.value = cat;
    $('#task-category').appendChild(opt);
  });

  // ─── Titlebar ─────────────────────────────────────────────────────────────────

  $('#btn-close').addEventListener('click', () => api.close());
  $('#btn-min').addEventListener('click',   () => api.minimize());
  $('#btn-pin').addEventListener('click', (e) => {
    api.togglePin();
    e.currentTarget.classList.toggle('active');
  });

  // ─── Theme Toggle ──────────────────────────────────────────────────────────────

  const THEME_KEY = 'focushub-theme';
  const thumb     = document.querySelector('.theme-toggle-thumb');

  const applyTheme = (theme) => {
    document.documentElement.dataset.theme = theme === 'forge' ? 'forge' : '';
    if (thumb) thumb.textContent = theme === 'forge' ? '⬡' : '✿';
  };

  // Load saved theme
  api.get(THEME_KEY).then((saved) => applyTheme(saved || 'aurora'));

  $('#btn-theme').addEventListener('click', async () => {
    const current = document.documentElement.dataset.theme === 'forge' ? 'forge' : 'aurora';
    const next    = current === 'forge' ? 'aurora' : 'forge';
    applyTheme(next);
    await api.set(THEME_KEY, next);
    // Redraw mind-map with new theme colours
    mapDraw();
  });

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────────

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllForms();
    if (e.ctrlKey && e.key.toLowerCase() === 'n') { e.preventDefault(); openAddTaskForm(); }
    if (e.ctrlKey && ['1','2','3','4'].includes(e.key)) {
      e.preventDefault();
      switchTab(['focus','insights','wishlist','dreams'][Number(e.key) - 1]);
    }
  });

  // Show shortcut tooltip briefly on load
  setTimeout(() => $('#shortcut-tooltip').classList.add('show'),    350);
  setTimeout(() => $('#shortcut-tooltip').classList.remove('show'), 3500);

  // ─── Tab navigation ───────────────────────────────────────────────────────────

  const switchTab = (name) => {
    $$('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    $$('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `tab-${name}`));
    if (name === 'insights') renderInsights();
    if (name === 'dreams') {
      selectRandomQuote();
      setTimeout(() => resizeCanvas(), 60);
    }
  };

  $$('.tab-btn').forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  const closeAllForms = () => {
    $('#add-task-form').classList.add('hidden');
    $('#add-wish-form').classList.add('hidden');
    $('#wish-modal').classList.add('hidden');
    if (quoteFormEl) quoteFormEl.classList.add('hidden');
    $$('.task-menu').forEach((m) => m.classList.remove('open'));
    // exit connect mode
    connectingFromId = null;
    canvas.style.cursor = 'default';
    mapDraw();
  };

  const openAddTaskForm = () => {
    switchTab('focus');
    $('#add-task-form').classList.remove('hidden');
    $('#task-title').focus();
  };

  // ─── Focus / Tasks ────────────────────────────────────────────────────────────

  const renderFocus = () => {
    const tasks   = sortedTasks(data.tasks.filter(isTodayTask));
    const done    = tasks.filter(isTaskDone).length;
    const pending = tasks.filter((t) => !isTaskDone(t));
    const pct     = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    const minsLeft = pending.reduce((s, t) => s + (Number(t.minutes) || 30), 0);

    $('#daily-pill').textContent = (tasks.length && done === tasks.length)
      ? `🎉 Totul e gata • ${tasks.length}/${tasks.length}`
      : `${done}/${tasks.length} complete • ${formatDuration(minsLeft)} rămas`;
    $('#daily-mini-fill').style.width = `${pct}%`;
    $('#daily-card').classList.toggle('complete', tasks.length > 0 && done === tasks.length);

    const container = $('#tasks-by-category');
    container.replaceChildren();
    if (!tasks.length) {
      container.appendChild(emptyState('Niciun task pentru azi.', 'Apasă "+ Task" sau Ctrl+N pentru a începe.'));
      renderInsights();
      return;
    }

    CATEGORIES.forEach((cat) => {
      const catTasks = tasks.filter((t) => t.category === cat);
      if (!catTasks.length) return;
      const isCollapsed = data.collapsedCategories[cat];
      const group  = make('div', `category-card ${isCollapsed ? 'collapsed' : ''}`);
      const header = make('button', 'category-header');
      header.type = 'button';
      header.innerHTML = `<span>${cat}</span><small>${catTasks.length}</small>`;
      header.addEventListener('click', () => {
        data.collapsedCategories[cat] = !data.collapsedCategories[cat];
        saveData();
        renderFocus();
      });
      const body = make('div', 'category-body');
      catTasks.forEach((t) => body.appendChild(renderTask(t)));
      group.append(header, body);
      container.appendChild(group);
    });

    renderInsights();
  };

  const renderTask = (task) => {
    const done       = isTaskDone(task);
    const countdown  = getCountdown(task.deadline);
    const subsDone   = task.subtasks.filter((s) => s.done).length;
    const card       = make('article', `task-card energy-${task.energy} ${done ? 'done' : ''}`);
    card.draggable   = true;
    card.dataset.taskId  = task.id;
    card.dataset.category = task.category;

    // ── Checkbox ──
    const row   = make('div', 'task-main-row');
    const check = make('button', 'task-main-check', done ? '✓' : '');
    check.type = 'button';
    check.addEventListener('click', () => {
      const next = !isTaskDone(task);
      task.done = next;
      task.subtasks.forEach((s) => { s.done = next; });
      if (next) { playSparkle(); showToast('Task completat 🎉', 'success'); }
      saveData();
      renderFocus();
    });

    // ── Content ──
    const content   = make('div', 'task-content');
    const titleLine = make('div', 'task-title-line');
    const titleWrap = make('div');
    titleWrap.appendChild(make('div', 'task-title', task.title));
    if (task.description) titleWrap.appendChild(make('div', 'task-desc', task.description));

    // ── ··· Menu ──
    const menuWrap = make('div', 'task-menu-wrap');
    const menuBtn  = make('button', 'task-menu-btn', '···');
    menuBtn.type   = 'button';
    const menu = make('div', 'task-menu');
    const editBtn = make('button', '', '✎ Editează');
    editBtn.type  = 'button';
    editBtn.addEventListener('click', () => {
      $('#task-title').value       = task.title;
      $('#task-description').value = task.description || '';
      $('#task-subtasks').value    = task.subtasks.map((s) => s.text).join(', ');
      $('#task-category').value    = task.category;
      $('#task-energy').value      = task.energy;
      $('#task-deadline').value    = task.deadline || '';
      $('#task-minutes').value     = task.minutes || 30;
      editingTaskId = task.id;
      openAddTaskForm();
    });
    const deleteBtn = make('button', '', '🗑 Șterge');
    deleteBtn.type  = 'button';
    deleteBtn.addEventListener('click', () => {
      // FIX: use custom confirmAction instead of confirm()
      confirmAction('Sigur ștergi task-ul?', () => {
        data.tasks = data.tasks.filter((t) => t.id !== task.id);
        saveData();
        showToast('Task șters', 'danger');
        renderFocus();
      });
    });
    menu.append(editBtn, deleteBtn);
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      $$('.task-menu').forEach((m) => { if (m !== menu) m.classList.remove('open'); });
      menu.classList.toggle('open');
    });
    menuWrap.append(menuBtn, menu);
    titleLine.append(titleWrap, menuWrap);
    content.appendChild(titleLine);

    // ── Meta tags ──
    const meta = make('div', 'task-meta');
    meta.appendChild(make('span', `tag energy-tag ${task.energy}`, ENERGY_BADGE[task.energy]));
    if (countdown.timestamp) meta.appendChild(make('span', 'tag time-tag', countdown.timestamp));
    meta.appendChild(make('span', `tag task-countdown countdown-${countdown.state}`, countdown.text));
    meta.appendChild(make('span', 'tag category-tag', task.category));
    meta.appendChild(make('span', 'tag time-tag', formatDuration(task.minutes || 30)));
    content.appendChild(meta);

    // ── Subtasks ──
    if (task.subtasks.length) {
      const progressRow = make('div', 'task-progress-row');
      const bar  = make('div', 'task-sub-progress');
      const fill = make('div');
      fill.style.width = `${Math.round(taskSubPct(task) * 100)}%`;
      bar.appendChild(fill);
      progressRow.append(bar, make('small', '', `${subsDone}/${task.subtasks.length} subtask-uri`));
      content.appendChild(progressRow);

      const toggle = make('button', 'subtask-toggle',
        data.collapsedTasks[task.id] ? 'Arată checklist' : 'Ascunde checklist');
      toggle.type = 'button';
      toggle.addEventListener('click', () => {
        data.collapsedTasks[task.id] = !data.collapsedTasks[task.id];
        saveData();
        renderFocus();
      });
      content.appendChild(toggle);

      if (!data.collapsedTasks[task.id]) {
        const subList = make('div', 'subtasks-list');
        task.subtasks.forEach((sub) => {
          const label = make('label', 'subtask-row');
          const inp   = make('input');
          inp.type    = 'checkbox';
          inp.checked = sub.done;
          inp.addEventListener('change', () => {
            sub.done  = inp.checked;
            task.done = task.subtasks.every((s) => s.done);
            if (task.done) { playSparkle(); showToast('Task completat 🎉', 'success'); }
            saveData();
            renderFocus();
          });
          label.append(inp, make('span', '', sub.text));
          subList.appendChild(label);
        });
        content.appendChild(subList);
      }
    }

    row.append(check, content);
    card.appendChild(row);

    // ── Drag to reorder ──
    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', task.id);
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData('text/plain');
      if (!draggedId || draggedId === task.id) return;
      reorderWithinCategory(draggedId, task.id, task.category);
    });

    return card;
  };

  const reorderWithinCategory = (draggedId, targetId, cat) => {
    const catTasks = sortedTasks(data.tasks.filter((t) => t.category === cat && isTodayTask(t)));
    const dIdx = catTasks.findIndex((t) => t.id === draggedId);
    const tIdx = catTasks.findIndex((t) => t.id === targetId);
    if (dIdx < 0 || tIdx < 0) return;
    const [dragged] = catTasks.splice(dIdx, 1);
    catTasks.splice(tIdx, 0, dragged);
    catTasks.forEach((t, i) => { t.order = i + 1; });
    saveData();
    renderFocus();
  };

  // ── Task form ──

  $('#add-task-btn').addEventListener('click', openAddTaskForm);

  $('#cancel-task-btn').addEventListener('click', () => {
    editingTaskId = null;
    $('#add-task-form').reset();
    $('#task-energy').value  = 'medium';
    $('#task-minutes').value = 30;
    $('#add-task-form').classList.add('hidden');
  });

  $('#add-task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('#task-title').value.trim();
    if (!title) return;
    const subtasks = $('#task-subtasks').value
      .split(',').map((s) => s.trim()).filter(Boolean).map((s) => ({ text: s, done: false }));
    const payload = {
      title,
      description: $('#task-description').value.trim(),
      subtasks,
      deadline: $('#task-deadline').value,
      energy:   $('#task-energy').value,
      category: $('#task-category').value,
      minutes:  Number($('#task-minutes').value) || 30,
    };

    if (editingTaskId) {
      const task = data.tasks.find((t) => t.id === editingTaskId);
      if (task) {
        Object.assign(task, payload, {
          subtasks: payload.subtasks.map((s) => {
            const ex = task.subtasks.find((old) => old.text === s.text);
            return ex ? { ...s, done: ex.done } : s;
          }),
        });
        task.done = isTaskDone(task);
      }
      editingTaskId = null;
    } else {
      data.tasks.push({
        id: uid(), ...payload, done: false,
        createdAt: new Date().toISOString(), order: data.tasks.length + 1,
      });
    }

    e.target.reset();
    $('#task-energy').value  = 'medium';
    $('#task-minutes').value = 30;
    e.target.classList.add('hidden');
    saveData();
    showToast('Task salvat ✓', 'success');
    renderFocus();
  });

  // ─── Insights ─────────────────────────────────────────────────────────────────

  const renderInsights = () => {
    const tasks     = data.tasks.filter(isTodayTask);
    const done      = tasks.filter(isTaskDone).length;
    const remaining = tasks.length - done;
    const pct       = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    const mins      = tasks.filter((t) => !isTaskDone(t)).reduce((s, t) => s + (Number(t.minutes) || 30), 0);

    $('#insights-progress-label').textContent = `${pct}%`;
    $('#insights-progress-fill').style.width  = `${pct}%`;
    $('#insight-total').textContent           = String(tasks.length);
    $('#insight-remaining').textContent       = String(remaining);
    $('#insight-left').textContent            = formatDuration(mins);
    $('#insight-streak').textContent          = String(calculateStreak());

    const chart = $('#category-chart');
    chart.replaceChildren();
    CATEGORIES.forEach((cat) => {
      const count = tasks.filter((t) => t.category === cat).length;
      if (!count) return;
      const share = Math.round((count / tasks.length) * 100);
      const row = make('div', 'chart-row');
      row.innerHTML = `
        <div class="chart-label"><span>${cat}</span><strong>${count} (${share}%)</strong></div>
        <div class="chart-track"><div style="width:${share}%;background:${CATEGORY_COLORS[cat]}"></div></div>`;
      chart.appendChild(row);
    });
    if (!chart.children.length)
      chart.appendChild(emptyState('Nu avem statistici încă.', 'Adaugă task-uri pentru azi.'));
  };

  // ─── Wishlist ─────────────────────────────────────────────────────────────────

  const renderWishes = () => {
    const list = $('#wishes-list');
    list.replaceChildren();
    const visible = data.wishes.filter((w) => activeWishCategory === 'all' || w.category === activeWishCategory);
    if (!visible.length) {
      list.appendChild(emptyState('Wishlist-ul e liber.', 'Adaugă o idee pentru mai târziu.'));
      return;
    }
    visible.forEach((wish) => {
      const item = make('article', 'wish-item');

      // FIX: icon was missing from grid layout — add as first child
      item.appendChild(make('div', 'wish-icon', WISH_ICONS[wish.category] || '💡'));

      const body = make('div');
      body.appendChild(make('div', 'wish-title', wish.text));
      if (wish.note) body.appendChild(make('div', 'wish-note', wish.note));
      body.appendChild(make('span', 'tag category-tag', wish.category || 'other'));
      item.appendChild(body);

      const actions = make('div', 'wish-actions');
      const calBtn  = make('button', 'wish-calendar-btn', '→ Calendar');
      calBtn.type   = 'button';
      calBtn.addEventListener('click', () => openWishModal(wish.id));
      const delBtn  = make('button', 'soft-delete', '× Șterge');
      delBtn.type   = 'button';
      delBtn.addEventListener('click', () => {
        data.wishes = data.wishes.filter((w) => w.id !== wish.id);
        saveData();
        renderWishes();
      });
      actions.append(calBtn, delBtn);
      item.appendChild(actions);

      list.appendChild(item);
    });
  };

  const openWishModal = (wishId) => {
    pendingWishId = wishId;
    const wish = data.wishes.find((w) => w.id === wishId);
    $('#wish-modal-text').textContent    = wish?.text || '';
    $('#wish-modal-deadline').value      = '';
    $('#wish-modal').classList.remove('hidden');
  };

  $('#wish-modal-cancel').addEventListener('click', () => {
    pendingWishId = null;
    $('#wish-modal').classList.add('hidden');
  });

  $('#wish-modal-confirm').addEventListener('click', () => {
    const wish = data.wishes.find((w) => w.id === pendingWishId);
    if (!wish) return;
    data.tasks.push({
      id: uid(), title: wish.text, description: wish.note || '', subtasks: [],
      deadline: $('#wish-modal-deadline').value, energy: 'medium', category: 'Quick Wins',
      minutes: 30, done: false, createdAt: new Date().toISOString(), order: data.tasks.length + 1,
    });
    data.wishes = data.wishes.filter((w) => w.id !== wish.id);
    pendingWishId = null;
    $('#wish-modal').classList.add('hidden');
    saveData();
    showToast('Wish convertit în task ✓', 'warn');
    renderFocus();
    renderWishes();
  });

  $$('.pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      $$('.pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      activeWishCategory = pill.dataset.cat;
      renderWishes();
    });
  });

  $('#add-wish-btn').addEventListener('click', () => {
    $('#add-wish-form').classList.remove('hidden');
    $('#wish-input').focus();
  });
  $('#cancel-wish-btn').addEventListener('click', () => {
    $('#add-wish-form').reset();
    $('#add-wish-form').classList.add('hidden');
  });
  $('#add-wish-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('#wish-input').value.trim();
    if (!text) return;
    data.wishes.unshift({ id: uid(), text, category: $('#wish-category').value, note: $('#wish-note').value.trim() });
    e.target.reset();
    e.target.classList.add('hidden');
    saveData();
    showToast('Idee adăugată ✓', 'success');
    renderWishes();
  });

  // ─── Dreams: sub-nav ─────────────────────────────────────────────────────────

  $$('.dreams-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.dreams-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      $$('.dreams-panel').forEach((p) => {
        const show = p.id === `dreams-panel-${btn.dataset.dreams}`;
        p.classList.toggle('active',  show);
        p.classList.toggle('hidden', !show);
      });
      if (btn.dataset.dreams === 'map') setTimeout(() => resizeCanvas(), 60);
    });
  });

  // ─── Dreams: Scratchpad ───────────────────────────────────────────────────────

  const scratchpad  = $('#scratchpad');
  const scratchSave = $('#scratch-save');
  scratchpad.value  = data.scratchpad || '';
  let scratchTimer;
  scratchpad.addEventListener('input', () => {
    clearTimeout(scratchTimer);
    scratchTimer = setTimeout(() => {
      data.scratchpad = scratchpad.value;
      saveData();
      scratchSave.classList.add('show');
      setTimeout(() => scratchSave.classList.remove('show'), 1500);
    }, 450);
  });

  // ─── Dreams: Quotes ───────────────────────────────────────────────────────────

  let quoteFormEl = null;

  const buildQuoteForm = () => {
    if (quoteFormEl) return quoteFormEl;
    const form       = make('div', 'task-form');
    const textInput  = make('input', 'form-input');
    textInput.type   = 'text';
    textInput.placeholder = 'Citat...';
    const authInput  = make('input', 'form-input');
    authInput.type   = 'text';
    authInput.placeholder = 'Autor (opțional)';
    const actions    = make('div', 'form-actions');
    const saveBtn    = make('button', 'btn-save', 'Salvează');
    saveBtn.type     = 'button';
    const cancelBtn  = make('button', 'btn-cancel', 'Anulează');
    cancelBtn.type   = 'button';
    saveBtn.addEventListener('click', () => {
      const text = textInput.value.trim();
      if (!text) return;
      const q = { id: uid(), text, author: authInput.value.trim() || 'Personal' };
      data.quotes.unshift(q);
      activeQuoteId = q.id;
      textInput.value = '';
      authInput.value = '';
      hideQuoteForm();
      saveData();
      renderQuotes();
    });
    cancelBtn.addEventListener('click', () => {
      textInput.value = ''; authInput.value = ''; hideQuoteForm();
    });
    actions.append(saveBtn, cancelBtn);
    form.append(textInput, authInput, actions);
    quoteFormEl = form;
    return form;
  };

  const showQuoteForm = () => {
    const form = buildQuoteForm();
    const ref  = $('#quotes-mini-list');
    if (!form.parentElement) ref.parentElement.insertBefore(form, ref);
    form.classList.remove('hidden');
    form.querySelector('input').focus();
  };
  const hideQuoteForm = () => { if (quoteFormEl) quoteFormEl.classList.add('hidden'); };

  const selectRandomQuote = () => {
    if (!data.quotes.length) return;
    activeQuoteId = data.quotes[Math.floor(Math.random() * data.quotes.length)].id;
    renderQuotes();
  };

  const renderQuotes = () => {
    const active = data.quotes.find((q) => q.id === activeQuoteId) || data.quotes[0];
    $('#quote-text').textContent   = active?.text   || 'Adaugă un citat care te inspiră.';
    $('#quote-author').textContent = `— ${(active?.author || 'FocusHub').toUpperCase()}`;
    const list = $('#quotes-mini-list');
    list.replaceChildren();
    data.quotes.slice(0, 5).forEach((q) => {
      const row = make('button', 'quote-mini-item', q.text);
      row.type  = 'button';
      row.addEventListener('click', () => { activeQuoteId = q.id; renderQuotes(); });
      const del = make('span', '', ' ×');
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        data.quotes = data.quotes.filter((item) => item.id !== q.id);
        activeQuoteId = data.quotes[0]?.id || null;
        saveData();
        renderQuotes();
      });
      row.appendChild(del);
      list.appendChild(row);
    });
  };

  $('#add-quote-btn').addEventListener('click', showQuoteForm);

  // ─── Dreams: Mind Map ─────────────────────────────────────────────────────────

  const canvas = $('#map-canvas');
  const ctx    = canvas.getContext('2d');

  // Pan / zoom
  let mapOffsetX = 0, mapOffsetY = 0, mapScale = 1;
  let isPanning = false, panStart = {x:0,y:0}, panOrigin = {x:0,y:0};

  // Drag
  let draggingNodeId = null, dragNodeOffset = {x:0,y:0};

  // Connect mode
  let connectingFromId = null, connectPreviewX = 0, connectPreviewY = 0;

  // Selection & modal
  let selectedNodeId = null, modalNodeId = null, lastClickTime = 0;

  const mapNodes = () => data.mapNodes || [];

  // ── Coordinate transforms ──

  const toCanvas = (wx, wy) => ({ x: wx * mapScale + mapOffsetX, y: wy * mapScale + mapOffsetY });
  const toWorld  = (cx, cy) => ({ x: (cx - mapOffsetX) / mapScale, y: (cy - mapOffsetY) / mapScale });

  const getCanvasPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: cx - rect.left, y: cy - rect.top };
  };

  const nodeAt = (wx, wy) =>
    mapNodes().find((n) =>
      wx >= n.x - NODE_W / 2 && wx <= n.x + NODE_W / 2 &&
      wy >= n.y - NODE_H / 2 && wy <= n.y + NODE_H / 2
    );

  // ── Canvas resize ──

  const resizeCanvas = () => {
    const wrap = canvas.parentElement;
    const w = wrap.clientWidth  || 400;
    const h = wrap.clientHeight || 380;
    if (canvas.width === w && canvas.height === h) { mapDraw(); return; }
    canvas.width  = w;
    canvas.height = h;
    mapDraw();
  };

  // ── Draw helpers ──

  const drawRoundRect = (cx, x, y, w, h, r) => {
    cx.beginPath();
    cx.moveTo(x + r, y);
    cx.lineTo(x + w - r, y);
    cx.arcTo(x + w, y, x + w, y + r, r);
    cx.lineTo(x + w, y + h - r);
    cx.arcTo(x + w, y + h, x + w - r, y + h, r);
    cx.lineTo(x + r, y + h);
    cx.arcTo(x, y + h, x, y + h - r, r);
    cx.lineTo(x, y + r);
    cx.arcTo(x, y, x + r, y, r);
    cx.closePath();
  };

  // ── Main draw ──

  const mapDraw = () => {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Grid
    const isForge = document.documentElement.dataset.theme === 'forge';
    ctx.save();
    ctx.strokeStyle = isForge ? 'rgba(90,155,200,0.10)' : 'rgba(180,160,200,0.13)';
    ctx.lineWidth   = 1;
    const gs  = 32 * mapScale;
    const sx  = mapOffsetX % gs, sy = mapOffsetY % gs;
    for (let gx = sx; gx < W; gx += gs) { ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,H); ctx.stroke(); }
    for (let gy = sy; gy < H; gy += gs) { ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(W,gy); ctx.stroke(); }
    ctx.restore();

    const nodes = mapNodes();

    // Edges
    nodes.forEach((n) => {
      (n.connections || []).forEach((tid) => {
        const target = nodes.find((x) => x.id === tid);
        if (!target) return;
        const from = toCanvas(n.x, n.y);
        const to   = toCanvas(target.x, target.y);
        ctx.save();
        ctx.strokeStyle = isForge ? 'rgba(40,120,180,0.38)' : 'rgba(139,92,246,0.40)';
        ctx.lineWidth   = 2 * mapScale;
        ctx.setLineDash([6 * mapScale, 4 * mapScale]);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        const cpX = (from.x + to.x) / 2;
        ctx.bezierCurveTo(cpX, from.y, cpX, to.y, to.x, to.y);
        ctx.stroke();
        ctx.restore();
      });
    });

    // Connect-mode preview line
    if (connectingFromId) {
      const fn = nodes.find((n) => n.id === connectingFromId);
      if (fn) {
        const from = toCanvas(fn.x, fn.y);
        ctx.save();
        ctx.strokeStyle = isForge ? 'rgba(40,120,180,0.65)' : 'rgba(139,92,246,0.65)';
        ctx.lineWidth   = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(connectPreviewX || from.x, connectPreviewY || from.y);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Nodes
    nodes.forEach((node) => {
      const { x: cx, y: cy } = toCanvas(node.x, node.y);
      const w = NODE_W * mapScale, h = NODE_H * mapScale, r = NODE_R * mapScale;
      const isSel  = node.id === selectedNodeId;
      const isConn = node.id === connectingFromId;

      ctx.save();
      ctx.shadowColor = isForge ? 'rgba(20,60,100,0.18)' : 'rgba(100,60,140,0.18)';
      ctx.shadowBlur  = 10 * mapScale;
      drawRoundRect(ctx, cx - w/2, cy - h/2, w, h, r);
      ctx.fillStyle = node.color || NODE_COLORS[0];
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = isConn
        ? (isForge ? '#1a5e90' : '#7c3aed')
        : isSel
          ? (isForge ? '#0c1c28' : '#3d2c4e')
          : 'rgba(255,255,255,0.55)';
      ctx.lineWidth   = (isSel || isConn) ? 2.5 * mapScale : 1.5 * mapScale;
      drawRoundRect(ctx, cx - w/2, cy - h/2, w, h, r);
      ctx.stroke();

      ctx.fillStyle    = isForge ? '#0c1c28' : '#1e1b4b';
      ctx.font         = `${Math.round(13 * mapScale)}px ${isForge ? 'Space Grotesk' : 'DM Sans'}, sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      const maxW = w - 16 * mapScale;
      let label = node.title || 'Idee';
      while (ctx.measureText(label).width > maxW && label.length > 3) label = label.slice(0, -1);
      if (label !== node.title) label = label.slice(0, -1) + '…';
      ctx.fillText(label, cx, cy);

      // Note dot
      if (node.note) {
        ctx.beginPath();
        ctx.arc(cx + w/2 - 7*mapScale, cy - h/2 + 7*mapScale, 4*mapScale, 0, Math.PI*2);
        ctx.fillStyle = isForge ? '#2878b4' : '#7c3aed';
        ctx.fill();
      }

      // IMPROVED: show connect-mode hint badge on source node
      if (isConn) {
        ctx.save();
        const connColor = isForge ? '#2878b4' : '#7c3aed';
        ctx.fillStyle    = isForge ? 'rgba(40,120,180,0.15)' : 'rgba(124,58,237,0.15)';
        ctx.strokeStyle  = connColor;
        ctx.lineWidth    = 1;
        const bw = 90 * mapScale, bh = 20 * mapScale;
        const bx = cx - bw/2, by = cy - h/2 - bh - 6*mapScale;
        drawRoundRect(ctx, bx, by, bw, bh, 6*mapScale);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle    = connColor;
        ctx.font         = `${Math.round(10*mapScale)}px ${isForge ? 'Space Grotesk' : 'DM Sans'}, sans-serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Click pe alt nod →', cx, by + bh/2);
        ctx.restore();
      }

      ctx.restore();
    });

    // Empty hint
    if (!nodes.length) {
      ctx.save();
      ctx.fillStyle    = 'rgba(139,92,246,0.30)';
      ctx.font         = '14px DM Sans, sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Apasă "+ Idee nouă" pentru a începe', W/2, H/2 - 14);
      ctx.fillStyle = 'rgba(139,92,246,0.20)';
      ctx.font      = '12px DM Sans, sans-serif';
      ctx.fillText('Click dreapta pe un nod pentru a-l conecta cu altul', W/2, H/2 + 10);
      ctx.restore();
    }

    // IMPROVED: Connect-mode overlay banner at top of canvas
    if (connectingFromId) {
      ctx.save();
      ctx.fillStyle = 'rgba(124,58,237,0.12)';
      ctx.fillRect(0, 0, W, 32);
      ctx.fillStyle    = '#7c3aed';
      ctx.font         = 'bold 12px DM Sans, sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔗 Mod conectare activ — click pe un alt nod pentru a crea conexiunea. ESC pentru anulare.', W/2, 16);
      ctx.restore();
    }
  };

  // ── Canvas pointer events ──

  canvas.addEventListener('mousedown', (e) => {
    const { x, y } = getCanvasPos(e);
    const world = toWorld(x, y);
    const hit   = nodeAt(world.x, world.y);

    // Right-click → toggle connect mode
    if (e.button === 2) {
      e.preventDefault();
      if (hit) {
        connectingFromId = connectingFromId === hit.id ? null : hit.id;
        canvas.style.cursor = connectingFromId ? 'crosshair' : 'default';
      } else {
        connectingFromId = null;
        canvas.style.cursor = 'default';
      }
      mapDraw();
      return;
    }

    // Left-click in connect mode → create / remove connection
    if (connectingFromId) {
      if (hit && hit.id !== connectingFromId) {
        const fromNode = mapNodes().find((n) => n.id === connectingFromId);
        if (fromNode) {
          if (!fromNode.connections) fromNode.connections = [];
          const already = fromNode.connections.includes(hit.id);
          if (already) {
            fromNode.connections = fromNode.connections.filter((id) => id !== hit.id);
            showToast('Conexiune eliminată', 'warn');
          } else {
            fromNode.connections.push(hit.id);
            showToast('Noduri conectate ✓', 'success');
          }
          saveData();
        }
      }
      connectingFromId = null;
      canvas.style.cursor = 'default';
      mapDraw();
      return;
    }

    // Left-click on node → select / double-click → modal / drag
    if (hit) {
      const now2 = Date.now();
      if (now2 - lastClickTime < 350 && selectedNodeId === hit.id) {
        openNodeModal(hit.id);
        lastClickTime = 0;
        return;
      }
      lastClickTime    = now2;
      selectedNodeId   = hit.id;
      draggingNodeId   = hit.id;
      dragNodeOffset   = { x: world.x - hit.x, y: world.y - hit.y };
      canvas.style.cursor = 'grabbing';
      mapDraw();
    } else {
      // Pan
      selectedNodeId  = null;
      isPanning       = true;
      panStart        = { x, y };
      panOrigin       = { x: mapOffsetX, y: mapOffsetY };
      canvas.style.cursor = 'grabbing';
      mapDraw();
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const { x, y } = getCanvasPos(e);
    const world = toWorld(x, y);

    if (connectingFromId) {
      connectPreviewX = x; connectPreviewY = y;
      // update cursor based on whether hovering a node
      const hit = nodeAt(world.x, world.y);
      canvas.style.cursor = (hit && hit.id !== connectingFromId) ? 'pointer' : 'crosshair';
      mapDraw();
      return;
    }

    if (draggingNodeId) {
      const node = mapNodes().find((n) => n.id === draggingNodeId);
      if (node) { node.x = world.x - dragNodeOffset.x; node.y = world.y - dragNodeOffset.y; mapDraw(); }
      return;
    }

    if (isPanning) {
      mapOffsetX = panOrigin.x + (x - panStart.x);
      mapOffsetY = panOrigin.y + (y - panStart.y);
      mapDraw();
      return;
    }

    // Hover cursor feedback
    const hit = nodeAt(world.x, world.y);
    canvas.style.cursor = hit ? 'grab' : 'default';
  });

  canvas.addEventListener('mouseup', () => {
    if (draggingNodeId) { saveData(); draggingNodeId = null; }
    isPanning = false;
    if (!connectingFromId) canvas.style.cursor = 'default';
  });

  canvas.addEventListener('mouseleave', () => {
    if (draggingNodeId) { saveData(); draggingNodeId = null; }
    isPanning = false;
    if (!connectingFromId) canvas.style.cursor = 'default';
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const { x, y } = getCanvasPos(e);
    const delta    = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(3, Math.max(0.3, mapScale * delta));
    mapOffsetX = x - (x - mapOffsetX) * (newScale / mapScale);
    mapOffsetY = y - (y - mapOffsetY) * (newScale / mapScale);
    mapScale   = newScale;
    mapDraw();
  }, { passive: false });

  // ── Add node inline form ──

  const nodeAddForm   = make('div', 'task-form');
  nodeAddForm.style.cssText = 'display:none;gap:8px;margin-bottom:10px;padding:12px 14px;';
  const nodeAddInput  = make('input', 'form-input');
  nodeAddInput.placeholder = 'Titlul ideii...';
  nodeAddInput.maxLength   = 60;
  const nodeAddActions = make('div', 'form-actions');
  const nodeAddSave   = make('button', 'btn-save', 'Adaugă');
  nodeAddSave.type    = 'button';
  const nodeAddCancel = make('button', 'btn-cancel', 'Anulează');
  nodeAddCancel.type  = 'button';
  nodeAddActions.append(nodeAddSave, nodeAddCancel);
  nodeAddForm.append(nodeAddInput, nodeAddActions);
  $('.map-toolbar').parentElement.insertBefore(nodeAddForm, $('.map-toolbar'));

  const showNodeAddForm = () => { nodeAddForm.style.display = 'flex'; nodeAddInput.value = ''; nodeAddInput.focus(); };
  const hideNodeAddForm = () => { nodeAddForm.style.display = 'none'; nodeAddInput.value = ''; };

  const commitNewNode = () => {
    const title = nodeAddInput.value.trim();
    if (!title) return;
    if (!data.mapNodes) data.mapNodes = [];
    const W = canvas.width || 400, H = canvas.height || 380;
    const world = toWorld(W/2 + (Math.random()-0.5)*120, H/2 + (Math.random()-0.5)*100);
    data.mapNodes.push({
      id: uid(), title, x: world.x, y: world.y,
      color: NODE_COLORS[data.mapNodes.length % NODE_COLORS.length],
      note: '', connections: [],
    });
    saveData();
    mapDraw();
    hideNodeAddForm();
    showToast('Idee adăugată ✓', 'success');
  };

  $('#add-node-btn').addEventListener('click', showNodeAddForm);
  nodeAddSave.addEventListener('click', commitNewNode);
  nodeAddCancel.addEventListener('click', hideNodeAddForm);
  nodeAddInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); commitNewNode(); }
    if (e.key === 'Escape') hideNodeAddForm();
  });

  $('#reset-map-btn').addEventListener('click', () => {
    if (!data.mapNodes?.length) return;
    confirmAction('Resetezi tot mind map-ul?', () => {
      data.mapNodes = [];
      selectedNodeId = connectingFromId = null;
      mapOffsetX = mapOffsetY = 0;
      mapScale   = 1;
      canvas.style.cursor = 'default';
      saveData();
      mapDraw();
      showToast('Mind map resetat', 'warn');
    });
  });

  // ── Node modal ──

  const openNodeModal = (nodeId) => {
    const node = mapNodes().find((n) => n.id === nodeId);
    if (!node) return;
    modalNodeId = nodeId;
    $('#modal-node-title').value = node.title || '';
    $('#modal-note-body').value  = node.note  || '';
    $('#modal-char-count').textContent = `${(node.note || '').length} caractere`;
    $('#modal-cat-pill').textContent   = '●';
    $('#modal-cat-pill').style.color   = node.color || '#c4b5fd';
    $('#modal-cat-pill').style.background = (node.color || '#c4b5fd') + '33';

    const linked = node.linkedTaskId ? data.tasks.find((t) => t.id === node.linkedTaskId) : null;
    if (linked) {
      $('#modal-linked-task').classList.remove('hidden');
      $('#modal-linked-task-title').textContent = linked.title;
    } else {
      node.linkedTaskId = null;
      $('#modal-linked-task').classList.add('hidden');
    }

    $('#node-modal-overlay').classList.remove('hidden');
    $('#modal-node-title').focus();
  };

  const closeNodeModal = () => {
    $('#node-modal-overlay').classList.add('hidden');
    modalNodeId = null;
  };

  $('#modal-close-btn').addEventListener('click', closeNodeModal);
  $('#node-modal-overlay').addEventListener('click', (e) => {
    if (e.target === $('#node-modal-overlay')) closeNodeModal();
  });

  $('#modal-note-body').addEventListener('input', () => {
    $('#modal-char-count').textContent = `${$('#modal-note-body').value.length} caractere`;
  });

  $('#modal-save-btn').addEventListener('click', () => {
    const node = mapNodes().find((n) => n.id === modalNodeId);
    if (!node) return;
    node.title = $('#modal-node-title').value.trim() || node.title;
    node.note  = $('#modal-note-body').value;
    saveData();
    mapDraw();
    closeNodeModal();
    showToast('Nod salvat ✓', 'success');
  });

  $('#modal-delete-btn').addEventListener('click', () => {
    // FIX: use confirmAction instead of confirm()
    confirmAction('Ștergi acest nod și conexiunile sale?', () => {
      data.mapNodes = data.mapNodes.filter((n) => n.id !== modalNodeId);
      data.mapNodes.forEach((n) => {
        n.connections = (n.connections || []).filter((id) => id !== modalNodeId);
      });
      if (selectedNodeId === modalNodeId) selectedNodeId = null;
      saveData();
      mapDraw();
      closeNodeModal();
      showToast('Nod șters', 'danger');
    });
  });

  $('#modal-send-focus-btn').addEventListener('click', () => {
    const node = mapNodes().find((n) => n.id === modalNodeId);
    if (!node) return;
    const newTask = {
      id: uid(), title: node.title || 'Idee din mind map',
      description: node.note || '', subtasks: [],
      deadline: '', energy: 'medium', category: 'Proiecte Personale',
      minutes: 30, done: false, createdAt: new Date().toISOString(), order: data.tasks.length + 1,
    };
    data.tasks.push(newTask);
    node.linkedTaskId = newTask.id;
    saveData();
    mapDraw();
    closeNodeModal();
    showToast('Trimis în Focus ✓', 'success');
    renderFocus();
  });

  $('#modal-unlink-btn').addEventListener('click', () => {
    const node = mapNodes().find((n) => n.id === modalNodeId);
    if (node) { node.linkedTaskId = null; saveData(); mapDraw(); }
    $('#modal-linked-task').classList.add('hidden');
  });

  // ─── Global close menus on outside click ─────────────────────────────────────

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.task-menu-wrap'))
      $$('.task-menu').forEach((m) => m.classList.remove('open'));
  });

  // ─── Live countdown refresh ───────────────────────────────────────────────────

  const updateCountdowns = () => {
    $$('.task-card').forEach((card) => {
      const task = data.tasks.find((t) => t.id === card.dataset.taskId);
      if (!task) return;
      const cd   = getCountdown(task.deadline);
      const span = card.querySelector('.task-countdown');
      if (!span) return;
      span.className   = `tag task-countdown countdown-${cd.state}`;
      span.textContent = cd.text;
    });
  };
  setInterval(updateCountdowns, 60000);

  // ─── ResizeObserver for canvas ────────────────────────────────────────────────

  const ro = new ResizeObserver(resizeCanvas);
  ro.observe(canvas.parentElement);
  resizeCanvas();

  // ─── Initial render ───────────────────────────────────────────────────────────

  renderFocus();
  renderWishes();
  selectRandomQuote();
});