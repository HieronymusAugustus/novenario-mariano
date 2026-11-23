(() => {
  'use strict';

  const STORAGE_KEYS = {
    THEME: 'nm_theme_v1',
    FONT: 'nm_font_scale_v1',
    LANG: 'nm_closing_lang_v1',
    PROGRESS: 'nm_progress_v1'
  };

  const MONTHS_PT = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const state = {
    data: null,
    currentView: 'novenas',
    previousView: 'novenas',
    activeNovenaId: null,
    activeOccurrenceIdx: 0,
    calendarYear: new Date().getFullYear(),
    searchQuery: '',
    fontScale: parseFloat(localStorage.getItem(STORAGE_KEYS.FONT) || '1.08'),
    closingLang: localStorage.getItem(STORAGE_KEYS.LANG) || 'both',
    progress: loadProgress(),
    deferredInstallPrompt: null
  };

  // --- Utilities ---
  function loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESS) || '{}');
    } catch {
      return {};
    }
  }

  function saveProgress() {
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(state.progress));
  }

  function progressKey(novenaId, occIdx, year) {
    return `${novenaId}__${occIdx}__${year}`;
  }

  function getCompletedDays(novenaId, occIdx, year) {
    const k = progressKey(novenaId, occIdx, year);
    const arr = state.progress[k];
    return Array.isArray(arr) ? arr : [];
  }

  function setCompletedDays(novenaId, occIdx, year, daysArr) {
    const k = progressKey(novenaId, occIdx, year);
    const unique = [...new Set(daysArr)].sort((a, b) => a - b);
    state.progress[k] = unique;
    saveProgress();
  }

  // Gregorian Easter Sunday (Meeus/Jones/Butcher algorithm)
  function getEasterDate(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  function addDays(date, days) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + days);
    return d;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function diffDays(a, b) {
    const msPerDay = 86400000;
    const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((utcA - utcB) / msPerDay);
  }

  function formatDateBR(date) {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
  }

  function formatDateLongPT(date) {
    return `${date.getDate()} de ${MONTHS_PT[date.getMonth()].toLowerCase()}`;
  }

  function resolveOccurrenceRange(occ, year) {
    let start;
    if (occ.type === 'easter_offset') {
      start = addDays(getEasterDate(year), occ.offset);
    } else {
      start = new Date(year, occ.month - 1, occ.day);
    }
    const end = addDays(start, occ.days - 1);
    return { start, end, days: occ.days };
  }

  function getAllScheduledOccurrences(year) {
    const list = [];
    for (const novena of state.data.novenas) {
      novena.occurrences.forEach((occ, occIdx) => {
        const range = resolveOccurrenceRange(occ, year);
        list.push({
          novena,
          occ,
          occIdx,
          year,
          start: range.start,
          end: range.end,
          days: range.days
        });
      });
    }
    list.sort((a, b) => a.start - b.start);
    return list;
  }

  function getTodayStatus() {
    const today = startOfDay(new Date());
    const year = today.getFullYear();
    const candidates = [
      ...getAllScheduledOccurrences(year - 1),
      ...getAllScheduledOccurrences(year),
      ...getAllScheduledOccurrences(year + 1)
    ];

    const active = [];
    let nextUpcoming = null;

    for (const item of candidates) {
      if (today >= item.start && today <= item.end) {
        const dayNum = diffDays(today, item.start) + 1;
        active.push({ ...item, currentDay: dayNum });
      } else if (item.start > today) {
        if (!nextUpcoming || item.start < nextUpcoming.start) {
          nextUpcoming = { ...item, daysUntil: diffDays(item.start, today) };
        }
      }
    }
    return { today, active, nextUpcoming };
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
  }

  // --- Theme & Typography ---
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#0B1224' : '#14327A');
    }
  }

  function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved === 'dark' || saved === 'light') {
      applyTheme(saved);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      applyTheme('dark');
    } else {
      applyTheme('light');
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  function applyFontScale(scale) {
    const clamped = Math.max(0.88, Math.min(1.5, Number(scale.toFixed(2))));
    state.fontScale = clamped;
    document.documentElement.style.setProperty('--prayer-font-size', `${clamped}rem`);
    localStorage.setItem(STORAGE_KEYS.FONT, String(clamped));
  }

  // --- ICS Calendar Export ---
  function pad2(n) { return String(n).padStart(2, '0'); }
  function formatIcsDate(date) {
    return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
  }

  function buildIcsContent(items) {
    const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Congregacao Mariana Imaculada Conceicao e Sao Jose//Novenario Mariano//PT',
      'CALSCALE:GREGORIAN',
      'X-WR-CALNAME:Novenário Mariano'
    ];

    items.forEach((item) => {
      const uid = `nm-${item.novena.id}-${item.occIdx}-${item.year}@novenario-mariano`;
      const endExclusive = addDays(item.end, 1);
      const summary = `${item.novena.title} (${item.days} dias)`;
      const desc = `${item.occ.label}. ${item.novena.feast_label}. Congregação Mariana Imaculada Conceição e São José — Curitiba/PR.`;
      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${nowStamp}`,
        `DTSTART;VALUE=DATE:${formatIcsDate(item.start)}`,
        `DTEND;VALUE=DATE:${formatIcsDate(endExclusive)}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${desc}`,
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:Lembrete: ${summary}`,
        'TRIGGER:-PT1H',
        'END:VALARM',
        'END:VEVENT'
      );
    });

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  function downloadIcs(filename, items) {
    const content = buildIcsContent(items);
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Arquivo de agenda (.ics) baixado!');
  }

  // --- Rendering ---
  function renderTodayBanner() {
    const slot = document.getElementById('today-banner-slot');
    const { active, nextUpcoming } = getTodayStatus();

    if (active.length > 0) {
      const itemsHtml = active.map((item) => {
        const done = getCompletedDays(item.novena.id, item.occIdx, item.year);
        const isTodayDone = done.includes(item.currentDay);
        return `
          <div class="today-item" data-open-novena="${item.novena.id}" data-occ-idx="${item.occIdx}" role="button" tabindex="0">
            <img src="./${item.novena.image}" alt="${escapeHtml(item.novena.short_title)}" class="today-thumb">
            <div class="today-info">
              <h3>${escapeHtml(item.novena.title)}</h3>
              <p>Dia ${item.currentDay} de ${item.days} • ${formatDateBR(item.start)} a ${formatDateBR(item.end)}${isTodayDone ? ' • Rezado hoje ✓' : ''}</p>
            </div>
            <span class="today-cta">${isTodayDone ? 'Abrir' : 'Rezar hoje'}</span>
          </div>
        `;
      }).join('');

      slot.innerHTML = `
        <div class="today-banner">
          <span class="today-badge">✦ Em andamento hoje</span>
          ${itemsHtml}
        </div>
      `;
    } else if (nextUpcoming) {
      const daysLabel = nextUpcoming.daysUntil === 1
        ? 'Começa amanhã'
        : `Faltam ${nextUpcoming.daysUntil} dias`;

      slot.innerHTML = `
        <div class="today-banner">
          <span class="today-badge">✦ Próxima no calendário • ${daysLabel}</span>
          <div class="today-item" data-open-novena="${nextUpcoming.novena.id}" data-occ-idx="${nextUpcoming.occIdx}" role="button" tabindex="0">
            <img src="./${nextUpcoming.novena.image}" alt="${escapeHtml(nextUpcoming.novena.short_title)}" class="today-thumb">
            <div class="today-info">
              <h3>${escapeHtml(nextUpcoming.novena.title)}</h3>
              <p>Início em ${formatDateLongPT(nextUpcoming.start)} • ${nextUpcoming.days} dias</p>
            </div>
            <span class="today-cta">Ver oração</span>
          </div>
        </div>
      `;
    } else {
      slot.innerHTML = '';
    }

    slot.querySelectorAll('[data-open-novena]').forEach((el) => {
      const openFn = () => openNovena(el.dataset.openNovena, Number(el.dataset.occIdx || 0));
      el.addEventListener('click', openFn);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openFn();
        }
      });
    });
  }

  function renderNovenasGrid() {
    const grid = document.getElementById('novenas-grid');
    const countEl = document.getElementById('novena-count');
    const q = state.searchQuery.trim().toLowerCase();
    const { active } = getTodayStatus();
    const activeIds = new Set(active.map((a) => a.novena.id));
    const currentYear = new Date().getFullYear();

    const filtered = state.data.novenas.filter((n) => {
      if (!q) return true;
      const haystack = `${n.number} ${n.title} ${n.start_label} ${n.feast_label} ${n.subtitle || ''}`.toLowerCase();
      return haystack.includes(q);
    });

    countEl.textContent = String(filtered.length);

    if (filtered.length === 0) {
      grid.innerHTML = `<p class="small-text">Nenhuma novena encontrada para "${escapeHtml(state.searchQuery)}".</p>`;
      return;
    }

    grid.innerHTML = filtered.map((n) => {
      const primaryOcc = n.occurrences[0];
      const done = getCompletedDays(n.id, 0, currentYear);
      const pct = Math.round((done.length / primaryOcc.days) * 100);
      const isActive = activeIds.has(n.id);

      return `
        <button class="novena-card" type="button" data-novena-id="${n.id}">
          <div class="card-thumb-wrap">
            <img src="./${n.image}" alt="${escapeHtml(n.short_title)}" loading="lazy">
            <span class="card-num">${n.number}</span>
          </div>
          <div class="card-body">
            <div>
              <h3 class="card-title">${escapeHtml(n.title)}</h3>
              <p class="card-date">${escapeHtml(n.start_label)}</p>
            </div>
            <div class="card-badges">
              ${isActive ? '<span class="mini-tag active-now">Ativa hoje</span>' : ''}
              ${n.closing.bilingual ? '<span class="mini-tag latin">Latim / PT</span>' : ''}
              ${n.complementary ? '<span class="mini-tag bonus">Complementar</span>' : ''}
            </div>
            <div class="card-progress">
              <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
              <span class="progress-text">${done.length}/${primaryOcc.days}</span>
            </div>
          </div>
        </button>
      `;
    }).join('');

    grid.querySelectorAll('.novena-card').forEach((card) => {
      card.addEventListener('click', () => openNovena(card.dataset.novenaId, 0));
    });
  }

  function renderCalendar() {
    const year = state.calendarYear;
    document.getElementById('calendar-year-label').textContent = String(year);
    const easter = getEasterDate(year);
    const setenarioStart = addDays(easter, -16);
    document.getElementById('easter-note').textContent =
      `Em ${year}, a Páscoa cai em ${formatDateLongPT(easter)} — o Setenário de Nossa Senhora das Dores começa em ${formatDateLongPT(setenarioStart)}.`;

    const occurrences = getAllScheduledOccurrences(year);
    const today = startOfDay(new Date());
    const byMonth = new Map();

    occurrences.forEach((item) => {
      const m = item.start.getMonth();
      if (!byMonth.has(m)) byMonth.set(m, []);
      byMonth.get(m).push(item);
    });

    const container = document.getElementById('calendar-list');
    let html = '';

    for (let m = 0; m < 12; m++) {
      const list = byMonth.get(m);
      if (!list || list.length === 0) continue;
      html += `<div class="month-group"><h3 class="month-title">${MONTHS_PT[m]}</h3>`;
      list.forEach((item) => {
        const isActive = today >= item.start && today <= item.end;
        const done = getCompletedDays(item.novena.id, item.occIdx, year);
        html += `
          <div class="cal-item ${isActive ? 'is-active' : ''}" data-cal-id="${item.novena.id}" data-cal-occ="${item.occIdx}" role="button" tabindex="0">
            <div class="cal-item-main">
              <h4>${escapeHtml(item.novena.title)}</h4>
              <p>${escapeHtml(item.occ.label)} • ${done.length}/${item.days} dias rezados${item.novena.complementary ? ' • Complementar' : ''}</p>
            </div>
            <span class="cal-date-pill">${formatDateBR(item.start)} – ${formatDateBR(item.end)}</span>
          </div>
        `;
      });
      html += `</div>`;
    }

    container.innerHTML = html;
    container.querySelectorAll('.cal-item').forEach((el) => {
      const fn = () => openNovena(el.dataset.calId, Number(el.dataset.calOcc || 0));
      el.addEventListener('click', fn);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fn();
        }
      });
    });
  }

  function renderAbout() {
    const meta = state.data.meta;
    const refsEl = document.getElementById('references-list');
    refsEl.innerHTML = meta.references.map((r) => `<li>${escapeHtml(r)}</li>`).join('');
    document.getElementById('cover-credit-text').textContent = meta.cover_credit;
    document.getElementById('organizer-text').textContent = `${meta.organizer} — ${meta.chapel}, ${meta.year}`;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isIos && !isStandalone) {
      document.getElementById('ios-install-card').classList.remove('hidden');
    }
  }

  function buildPrayerPlainText(novena) {
    const lines = [
      novena.title.toUpperCase(),
      novena.start_label,
      ''
    ];
    novena.sections.forEach((sec) => {
      if (sec.type === 'lead') lines.push(sec.text, '');
      if (sec.type === 'paragraph') lines.push(sec.text, '');
      if (sec.type === 'numbered_prayer') {
        lines.push(`${sec.num}. ${sec.text}`);
        if (sec.rubric) lines.push(sec.rubric);
        lines.push('');
      }
      if (sec.type === 'rubric') lines.push(sec.text);
      if (sec.type === 'ejaculation') lines.push(...sec.lines, '');
    });
    novena.closing.versicles_pt.forEach((vr) => {
      lines.push(`V. ${vr.v}`, `R. ${vr.r}`);
    });
    lines.push('', `Oremos. ${novena.closing.oremus_pt}`);
    if (novena.closing.doxology) lines.push('', novena.closing.doxology);
    lines.push('', '— Novenário Mariano (CM Imaculada Conceição e São José, Curitiba/PR)');
    return lines.join('\n');
  }

  function renderReader() {
    const novena = state.data.novenas.find((n) => n.id === state.activeNovenaId);
    if (!novena) return;

    const occIdx = Math.min(state.activeOccurrenceIdx, novena.occurrences.length - 1);
    const occ = novena.occurrences[occIdx];
    const year = new Date().getFullYear();
    const range = resolveOccurrenceRange(occ, year);
    const today = startOfDay(new Date());
    const todayDayNum = (today >= range.start && today <= range.end)
      ? diffDays(today, range.start) + 1
      : null;

    const completed = getCompletedDays(novena.id, occIdx, year);
    const nextUnchecked = Array.from({ length: occ.days }, (_, i) => i + 1)
      .find((d) => !completed.includes(d));

    const occSwitcherHtml = novena.occurrences.length > 1
      ? `<div class="lang-tabs" style="margin-bottom:10px;">
          ${novena.occurrences.map((o, idx) => `
            <button type="button" class="lang-tab ${idx === occIdx ? 'active' : ''}" data-switch-occ="${idx}">
              ${idx === 0 ? 'Setenário (7 dias)' : 'Novena (9 dias)'}
            </button>
          `).join('')}
        </div>`
      : '';

    const dayButtonsHtml = Array.from({ length: occ.days }, (_, idx) => {
      const d = idx + 1;
      const isDone = completed.includes(d);
      const isToday = todayDayNum === d;
      return `<button type="button" class="day-btn ${isDone ? 'done' : ''} ${isToday ? 'today-day' : ''}" data-day="${d}" aria-pressed="${isDone}" title="Dia ${d}${isToday ? ' (Hoje)' : ''}">${isDone ? '✓' : d}</button>`;
    }).join('');

    const sectionsHtml = novena.sections.map((sec) => {
      if (sec.type === 'lead') {
        return `<p class="prayer-lead">${escapeHtml(sec.text)}</p>`;
      }
      if (sec.type === 'paragraph') {
        return `<p class="prayer-block">${escapeHtml(sec.text)}</p>`;
      }
      if (sec.type === 'numbered_prayer') {
        return `
          <div class="prayer-block">
            <p style="margin:0;"><span class="prayer-num">${sec.num}.</span> ${escapeHtml(sec.text)}</p>
            ${sec.rubric ? `<p class="prayer-rubric">${escapeHtml(sec.rubric)}</p>` : ''}
          </div>
        `;
      }
      if (sec.type === 'rubric') {
        return `<p class="prayer-rubric">${escapeHtml(sec.text)}</p>`;
      }
      if (sec.type === 'ejaculation') {
        return `<div class="prayer-ejaculation">${sec.lines.map((l) => `<div>${escapeHtml(l)}</div>`).join('')}</div>`;
      }
      return '';
    }).join('');

    // Closing bilingual or PT-only
    const c = novena.closing;
    const langMode = c.bilingual ? state.closingLang : 'pt';

    const renderClosingCol = (label, versicles, oremusLabel, oremusText) => `
      <div class="closing-col">
        ${label ? `<p class="closing-col-label">${label}</p>` : ''}
        ${versicles.map((vr) => `
          <p class="vr-pair">
            <span class="vr-label">V.</span> ${escapeHtml(vr.v)}<br>
            <span class="vr-label">R.</span> ${escapeHtml(vr.r)}
          </p>
        `).join('')}
        <p class="oremus-text"><span class="oremus-label">${oremusLabel}</span> ${escapeHtml(oremusText)}</p>
      </div>
    `;

    let closingColsHtml = '';
    if (!c.bilingual || langMode === 'pt') {
      closingColsHtml = renderClosingCol(c.bilingual ? 'Português' : '', c.versicles_pt, 'Oremos.', c.oremus_pt);
    } else if (langMode === 'la') {
      closingColsHtml = renderClosingCol('Latim', c.versicles_la, 'Oremus.', c.oremus_la);
    } else {
      closingColsHtml =
        renderClosingCol('Latim', c.versicles_la, 'Oremus.', c.oremus_la) +
        renderClosingCol('Português', c.versicles_pt, 'Oremos.', c.oremus_pt);
    }

    const langToggleHtml = c.bilingual
      ? `<div class="lang-tabs" role="tablist" aria-label="Idioma da oração final">
          <button type="button" class="lang-tab ${langMode === 'pt' ? 'active' : ''}" data-lang="pt">Português</button>
          <button type="button" class="lang-tab ${langMode === 'la' ? 'active' : ''}" data-lang="la">Latim</button>
          <button type="button" class="lang-tab ${langMode === 'both' ? 'active' : ''}" data-lang="both">Lado a lado</button>
        </div>`
      : '';

    const container = document.getElementById('reader-container');
    container.innerHTML = `
      <div class="reader-hero">
        <button type="button" class="reader-art-btn" id="btn-open-lightbox" aria-label="Ampliar imagem sacra">
          <img src="./${novena.image}" alt="${escapeHtml(novena.artwork_caption)}" class="reader-art">
        </button>
        <p class="reader-caption">${escapeHtml(novena.artwork_caption)} (toque para ampliar)</p>
        <h2 class="reader-title">${novena.number}. ${escapeHtml(novena.title)}</h2>
        <p class="reader-meta">${escapeHtml(novena.start_label)} • ${escapeHtml(novena.feast_label)}</p>
        ${novena.subtitle ? `<p class="reader-subtitle">${escapeHtml(novena.subtitle)}</p>` : ''}
      </div>

      <div class="tracker-card">
        <div class="tracker-header">
          <h3>Acompanhamento (${completed.length}/${occ.days} dias em ${year})</h3>
          <span class="small-text">${formatDateBR(range.start)} a ${formatDateBR(range.end)}</span>
        </div>
        ${occSwitcherHtml}
        <div class="tracker-days">${dayButtonsHtml}</div>
        <div class="tracker-actions">
          ${nextUnchecked
            ? `<button type="button" class="btn-primary" id="btn-mark-next">Marcar Dia ${todayDayNum && !completed.includes(todayDayNum) ? todayDayNum : nextUnchecked} como rezado</button>`
            : `<span class="mini-tag active-now" style="font-size:0.84rem;padding:6px 12px;">✓ Ciclo concluído!</span>`
          }
          <button type="button" class="btn-secondary" id="btn-ics-single">+ Lembrete na Agenda</button>
          ${completed.length > 0 ? `<button type="button" class="btn-outline" id="btn-reset-novena">Reiniciar</button>` : ''}
        </div>
      </div>

      <div class="prayer-card">
        ${sectionsHtml}
      </div>

      <div class="closing-card">
        <div class="closing-header">
          <h3>Versículo e Oração Final</h3>
          ${langToggleHtml}
        </div>
        <div class="closing-grid ${langMode === 'both' ? 'both' : ''}">
          ${closingColsHtml}
        </div>
        ${c.doxology ? `<p class="doxology">${escapeHtml(c.doxology)}</p>` : ''}
      </div>

      <p class="small-text" style="text-align:center;">${escapeHtml(novena.source_note)}</p>
    `;

    // Bind reader events
    document.getElementById('btn-open-lightbox').addEventListener('click', () => {
      openLightbox(`./${novena.image}`, novena.artwork_caption);
    });

    container.querySelectorAll('[data-switch-occ]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.activeOccurrenceIdx = Number(btn.dataset.switchOcc);
        renderReader();
      });
    });

    container.querySelectorAll('.day-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const d = Number(btn.dataset.day);
        const cur = getCompletedDays(novena.id, occIdx, year);
        const updated = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d];
        setCompletedDays(novena.id, occIdx, year, updated);
        renderReader();
        renderNovenasGrid();
        renderTodayBanner();
      });
    });

    const markNextBtn = document.getElementById('btn-mark-next');
    if (markNextBtn) {
      markNextBtn.addEventListener('click', () => {
        const targetDay = (todayDayNum && !completed.includes(todayDayNum)) ? todayDayNum : nextUnchecked;
        setCompletedDays(novena.id, occIdx, year, [...completed, targetDay]);
        showToast(`Dia ${targetDay} marcado como rezado!`);
        renderReader();
        renderNovenasGrid();
        renderTodayBanner();
      });
    }

    const resetBtn = document.getElementById('btn-reset-novena');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        setCompletedDays(novena.id, occIdx, year, []);
        showToast('Progresso desta novena reiniciado.');
        renderReader();
        renderNovenasGrid();
        renderTodayBanner();
      });
    }

    document.getElementById('btn-ics-single').addEventListener('click', () => {
      downloadIcs(`novena-${novena.id}-${year}.ics`, [{
        novena,
        occ,
        occIdx,
        year,
        start: range.start,
        end: range.end,
        days: occ.days
      }]);
    });

    container.querySelectorAll('[data-lang]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.closingLang = btn.dataset.lang;
        localStorage.setItem(STORAGE_KEYS.LANG, state.closingLang);
        renderReader();
      });
    });
  }

  // --- Navigation ---
  function switchView(viewName, pushHash = true) {
    if (viewName !== 'reader') {
      state.previousView = viewName;
    }
    state.currentView = viewName;

    document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.remove('hidden');

    const isReader = viewName === 'reader';
    document.getElementById('main-header').classList.toggle('hidden', isReader);
    document.getElementById('reader-header').classList.toggle('hidden', !isReader);
    document.getElementById('bottom-nav').classList.toggle('hidden', isReader);

    document.querySelectorAll('.nav-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });

    if (viewName === 'calendario') renderCalendar();
    if (viewName === 'novenas') {
      renderTodayBanner();
      renderNovenasGrid();
    }

    window.scrollTo({ top: 0, behavior: 'instant' });

    if (pushHash) {
      const nextHash = isReader ? `#novena/${state.activeNovenaId}/${state.activeOccurrenceIdx}` : `#${viewName}`;
      if (window.location.hash !== nextHash) {
        history.pushState({ view: viewName, id: state.activeNovenaId, occIdx: state.activeOccurrenceIdx }, '', nextHash);
      }
    }
  }

  function openNovena(novenaId, occIdx = 0, pushHash = true) {
    state.activeNovenaId = novenaId;
    state.activeOccurrenceIdx = occIdx;
    renderReader();
    switchView('reader', pushHash);
  }

  function openLightbox(src, caption) {
    document.getElementById('lightbox-img').src = src;
    document.getElementById('lightbox-img').alt = caption;
    document.getElementById('lightbox-caption').textContent = caption;
    document.getElementById('lightbox').classList.remove('hidden');
  }

  function closeLightbox() {
    document.getElementById('lightbox').classList.add('hidden');
  }

  function handleHashRoute() {
    const hash = window.location.hash || '#novenas';
    if (hash.startsWith('#novena/')) {
      const parts = hash.replace('#novena/', '').split('/');
      const id = parts[0];
      const occ = Number(parts[1] || 0);
      if (state.data && state.data.novenas.some((n) => n.id === id)) {
        openNovena(id, occ, false);
        return;
      }
    }
    const clean = hash.replace('#', '');
    if (['novenas', 'calendario', 'sobre'].includes(clean)) {
      switchView(clean, false);
    } else {
      switchView('novenas', false);
    }
  }

  // --- PWA / Service Worker ---
  function initPwa() {
    const statusEl = document.getElementById('offline-status-text');
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          statusEl.textContent = 'Pronto para uso 100% offline. Todas as orações e imagens ficam salvas no aparelho.';
          reg.addEventListener('updatefound', () => {
            showToast('Nova versão disponível — recarregue para atualizar.');
          });
        })
        .catch(() => {
          statusEl.textContent = 'Modo offline requer acesso via HTTPS ou localhost (GitHub Pages, Netlify, etc.).';
        });
    } else {
      statusEl.textContent = 'Seu navegador não suporta Service Worker para cache offline.';
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      state.deferredInstallPrompt = e;
      document.getElementById('install-card').classList.remove('hidden');
    });

    document.getElementById('btn-install-pwa').addEventListener('click', async () => {
      if (!state.deferredInstallPrompt) return;
      state.deferredInstallPrompt.prompt();
      const { outcome } = await state.deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        showToast('Novenário Mariano instalado!');
        document.getElementById('install-card').classList.add('hidden');
      }
      state.deferredInstallPrompt = null;
    });
  }

  // --- Init ---
  async function init() {
    initTheme();
    applyFontScale(state.fontScale);

    // Global event bindings
    document.getElementById('btn-theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('btn-reader-theme').addEventListener('click', toggleTheme);
    document.getElementById('btn-font-dec').addEventListener('click', () => applyFontScale(state.fontScale - 0.08));
    document.getElementById('btn-font-inc').addEventListener('click', () => applyFontScale(state.fontScale + 0.08));

    document.getElementById('btn-back').addEventListener('click', () => {
      switchView(state.previousView || 'novenas');
    });

    document.getElementById('btn-share').addEventListener('click', async () => {
      const novena = state.data.novenas.find((n) => n.id === state.activeNovenaId);
      if (!novena) return;
      const text = buildPrayerPlainText(novena);
      if (navigator.share) {
        try {
          await navigator.share({ title: novena.title, text });
          return;
        } catch { /* fallback to clipboard */ }
      }
      try {
        await navigator.clipboard.writeText(text);
        showToast('Oração copiada para a área de transferência!');
      } catch {
        showToast('Não foi possível copiar automaticamente.');
      }
    });

    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    document.getElementById('search-input').addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderNovenasGrid();
    });

    document.getElementById('btn-year-prev').addEventListener('click', () => {
      state.calendarYear -= 1;
      renderCalendar();
    });

    document.getElementById('btn-year-next').addEventListener('click', () => {
      state.calendarYear += 1;
      renderCalendar();
    });

    document.getElementById('btn-export-ics-year').addEventListener('click', () => {
      const items = getAllScheduledOccurrences(state.calendarYear);
      downloadIcs(`novenario-mariano-${state.calendarYear}.ics`, items);
    });

    document.getElementById('btn-reset-all-progress').addEventListener('click', () => {
      if (confirm('Deseja apagar todas as marcações de dias rezados?')) {
        state.progress = {};
        saveProgress();
        renderNovenasGrid();
        renderTodayBanner();
        showToast('Todo o progresso foi zerado.');
      }
    });

    document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
    document.getElementById('lightbox').addEventListener('click', (e) => {
      if (e.target.id === 'lightbox') closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeLightbox();
    });

    window.addEventListener('popstate', handleHashRoute);

    // Load data
    try {
      const res = await fetch('./data/novenas.json');
      if (!res.ok) throw new Error('Falha ao carregar novenas.json');
      state.data = await res.json();
    } catch (err) {
      document.getElementById('novenas-grid').innerHTML =
        '<p class="small-text">Erro ao carregar os dados. Abra o aplicativo por um servidor web (HTTPS ou localhost).</p>';
      console.error(err);
      return;
    }

    renderTodayBanner();
    renderNovenasGrid();
    renderAbout();
    handleHashRoute();
    initPwa();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
