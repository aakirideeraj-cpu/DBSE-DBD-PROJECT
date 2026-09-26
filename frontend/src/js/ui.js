/* ==========================================================================
   MediBook — ui.js
   Shared toolkit used by all three panels. Nothing here knows about
   patients, doctors or admins — it only knows how to draw things.

     Util    — formatting and small helpers
     Icon    — inline SVG icons (no icon font, so nothing breaks offline)
     Toast   — transient confirmations
     Modal   — dialogs, including a reusable confirm() for destructive actions
     Render  — repeated markup: stat cards, status badges, empty states,
               loading skeletons, appointment rows
     Form    — reading values and showing per-field validation messages
   ========================================================================== */

/* ==========================================================================
   Util
   ========================================================================== */
const Util = {

  /* Anything that came from a user typing must go through this before it is
     put into innerHTML. The prototype interpolated raw input straight into
     template strings, which let a name like <img onerror=...> run. */
  esc(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  todayISO() {
    return new Date().toISOString().split('T')[0];
  },

  /* "2026-10-10" → "Sat, 10 Oct 2026" */
  formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
  },

  /* Short form for tables: "10 Oct 2026" */
  formatDateShort(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  },

  relativeDay(iso) {
    const diff = Math.round(
      (new Date(iso + 'T00:00:00') - new Date(Util.todayISO() + 'T00:00:00')) / 86400000
    );
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff > 1) return `In ${diff} days`;
    return `${Math.abs(diff)} days ago`;
  },

  /* "02:00 PM" → 840. Used for sorting slots chronologically. */
  timeToMinutes(t) {
    const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((t || '').trim());
    if (!m) return 0;
    let h = parseInt(m[1], 10) % 12;
    if (m[3].toUpperCase() === 'PM') h += 12;
    return h * 60 + parseInt(m[2], 10);
  },

  isPastDate(iso) {
    return iso < Util.todayISO();
  },

  currency(n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN');
  },

  initials(name) {
    if (!name) return '?';
    const parts = String(name).replace(/^Dr\.?\s*/i, '').trim().split(/\s+/);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
  },

  age(dob) {
    if (!dob) return '—';
    const b = new Date(dob + 'T00:00:00');
    if (isNaN(b)) return '—';
    const now = new Date();
    let a = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
    return a + ' yrs';
  },

  /* Turns "On Leave" into "onleave" for the badge class name. */
  slug(s) {
    return String(s || '').toLowerCase().replace(/[^a-z]/g, '');
  },

  isEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());
  },

  /* Delegated click handling: one listener per container instead of an
     onclick attribute on every generated button. */
  onClick(container, selector, handler) {
    container.addEventListener('click', (e) => {
      const el = e.target.closest(selector);
      if (el && container.contains(el)) handler(el, e);
    });
  }
};

/* ==========================================================================
   Icon — inline SVG, drawn in currentColor
   ========================================================================== */
const Icon = (() => {
  const PATHS = {
    activity:      '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    dashboard:     '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    search:        '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    calendar:      '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    'calendar-plus':'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="13" x2="12" y2="19"/><line x1="9" y1="16" x2="15" y2="16"/>',
    'calendar-off':'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="4" y1="20" x2="20" y2="6"/>',
    clock:         '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    user:          '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    users:         '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    'user-plus':   '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
    check:         '<polyline points="20 6 9 17 4 12"/>',
    'check-circle':'<circle cx="12" cy="12" r="10"/><polyline points="16.5 9 10.8 15 7.5 12"/>',
    x:             '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    'x-circle':    '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    plus:          '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    edit:          '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
    eye:           '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/>',
    logout:        '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    menu:          '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
    alert:         '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    shield:        '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
    clipboard:     '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
    stethoscope:   '<path d="M6 3v5a5 5 0 0 0 10 0V3"/><path d="M4 3h3"/><path d="M15 3h3"/><path d="M11 13v3a5 5 0 0 0 9 3"/><circle cx="20" cy="17" r="2"/>',
    phone:         '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
    mail:          '<rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22 6 12 13 2 6"/>',
    chart:         '<line x1="6" y1="20" x2="6" y2="15"/><line x1="12" y1="20" x2="12" y2="8"/><line x1="18" y1="20" x2="18" y2="12"/><line x1="3" y1="20" x2="21" y2="20"/>',
    award:         '<circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/>',
    wallet:        '<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
    filter:        '<polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3"/>',
    inbox:         '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Z"/>',
    power:         '<path d="M18.4 6.6a9 9 0 1 1-12.7 0"/><line x1="12" y1="2" x2="12" y2="12"/>',
    lock:          '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
  };

  /* Icon.get('check') → '<svg …>' */
  function get(name, cls = 'icon') {
    const body = PATHS[name] || PATHS.alert;
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }

  return { get };
})();

/* ==========================================================================
   Toast
   ========================================================================== */
const Toast = (() => {
  let region;

  function show(message, tone = 'default') {
    region = region || document.getElementById('toast-region');
    const el = document.createElement('div');
    el.className = 'toast' + (tone === 'ok' ? ' is-ok' : tone === 'bad' ? ' is-bad' : '');
    const icon = tone === 'bad' ? 'alert' : tone === 'ok' ? 'check' : 'activity';
    el.innerHTML = Icon.get(icon, 'icon icon-sm') + `<span>${Util.esc(message)}</span>`;
    region.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  return {
    show,
    ok:  (m) => show(m, 'ok'),
    bad: (m) => show(m, 'bad')
  };
})();

/* ==========================================================================
   Modal
   One backdrop element is reused for every dialog in the app.
   ========================================================================== */
const Modal = (() => {
  let backdrop, box, lastFocus;

  function mount() {
    if (backdrop) return;
    backdrop = document.getElementById('modal-root');
    box = backdrop.querySelector('.modal');
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && backdrop.classList.contains('open')) close();
    });
  }

  /**
   * open({ title, subtitle, body, actions, wide, onMount })
   * actions: [{ label, variant, onClick, keepOpen }]
   *   onClick may return false to keep the dialog open (e.g. failed validation).
   */
  function open({ title, subtitle = '', body = '', actions = [], wide = false, onMount }) {
    mount();
    lastFocus = document.activeElement;
    box.className = 'modal' + (wide ? ' modal-wide' : '');
    box.innerHTML = `
      <div class="modal-head">
        <div>
          <h3 id="modal-title">${Util.esc(title)}</h3>
          ${subtitle ? `<p>${Util.esc(subtitle)}</p>` : ''}
        </div>
        <button class="btn btn-ghost btn-sm" data-modal-close aria-label="Close dialog">${Icon.get('x', 'icon icon-sm')}</button>
      </div>
      <div class="modal-body">${body}</div>
      ${actions.length ? '<div class="modal-foot"></div>' : ''}`;

    const foot = box.querySelector('.modal-foot');
    actions.forEach(a => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-' + (a.variant || 'secondary');
      btn.textContent = a.label;
      btn.addEventListener('click', async () => {
        const result = a.onClick ? await a.onClick(box) : undefined;
        if (result !== false && !a.keepOpen) close();
      });
      foot.appendChild(btn);
    });

    box.querySelector('[data-modal-close]').addEventListener('click', close);
    backdrop.classList.add('open');
    if (onMount) onMount(box);

    const focusTarget = box.querySelector('input, select, textarea, .btn-primary, .btn-danger');
    if (focusTarget) focusTarget.focus();
  }

  function close() {
    if (!backdrop) return;
    backdrop.classList.remove('open');
    box.innerHTML = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* Confirmation for destructive actions. Resolves true / false. */
  function confirm({ title, message, confirmLabel = 'Confirm', danger = false }) {
    return new Promise(resolve => {
      let answered = false;
      open({
        title,
        body: `<p style="font-size:13.5px;color:var(--ink-muted)">${Util.esc(message)}</p>`,
        actions: [
          { label: 'Keep it', variant: 'secondary', onClick: () => { answered = true; resolve(false); } },
          { label: confirmLabel, variant: danger ? 'danger' : 'primary', onClick: () => { answered = true; resolve(true); } }
        ]
      });
      /* If the user dismisses with Escape or the backdrop, treat it as "no". */
      const observer = new MutationObserver(() => {
        if (backdrop.classList.contains('open')) return;
        observer.disconnect();
        if (!answered) { answered = true; resolve(false); }
      });
      observer.observe(backdrop, { attributes: true, attributeFilter: ['class'] });
    });
  }

  return { open, close, confirm, get element() { return box; } };
})();

/* ==========================================================================
   Render — repeated markup, written once
   ========================================================================== */
const Render = {

  statusBadge(status) {
    return `<span class="badge badge-${Util.slug(status)}"><span class="dot"></span>${Util.esc(status)}</span>`;
  },

  availabilityBadge(status) {
    return `<span class="badge badge-${Util.slug(status)}"><span class="dot"></span>${Util.esc(status)}</span>`;
  },

  /* stats: [{ value, label, tone }] */
  statGrid(stats) {
    return `<div class="stat-grid">${stats.map(s => `
      <div class="stat${s.tone ? ' is-' + s.tone : ''}">
        <div class="stat-value">${Util.esc(s.value)}</div>
        <div class="stat-label">${Util.esc(s.label)}</div>
      </div>`).join('')}</div>`;
  },

  empty({ icon = 'inbox', title, message = '', action = '' }) {
    return `<div class="empty">
      ${Icon.get(icon, 'icon icon-lg')}
      <h4>${Util.esc(title)}</h4>
      ${message ? `<p>${Util.esc(message)}</p>` : ''}
      ${action}
    </div>`;
  },

  skeletonCards(count = 3) {
    const card = `<div class="skeleton">
      <div class="sk-line" style="width:55%;height:14px"></div>
      <div class="sk-line" style="width:80%"></div>
      <div class="sk-line" style="width:65%"></div>
      <div class="sk-line" style="width:40%"></div>
    </div>`;
    return `<div class="skeleton-grid">${card.repeat(count)}</div>`;
  },

  skeletonRows(count = 4) {
    return `<div class="card">${'<div class="sk-line" style="width:100%;height:16px;margin-bottom:14px"></div>'.repeat(count)}</div>`;
  },

  /**
   * One appointment row. `perspective` decides whose name is shown as the
   * headline: patients see the doctor, doctors and admins see the patient.
   * `actions` is raw HTML for the buttons that role is allowed to use.
   */
  appointment(a, { perspective = 'patient', actions = '' } = {}) {
    const headline = perspective === 'patient' ? a.doctor_name : a.patient_name;
    const sub = perspective === 'patient'
      ? a.specialization
      : `Patient ID ${a.patient_id}${a.patient_phone ? ' · ' + a.patient_phone : ''}`;

    return `<article class="appt s-${Util.slug(a.status)}" data-appointment-id="${a.appointment_id}">
      <div class="grow">
        <div class="title">${Util.esc(headline)}</div>
        <div class="meta">${Util.esc(sub)}</div>
        <div class="meta">
          ${Icon.get('calendar', 'icon icon-sm')} ${Util.esc(Util.formatDate(a.appointment_date))}
          <span class="faint">(${Util.esc(Util.relativeDay(a.appointment_date))})</span>
          &nbsp; ${Icon.get('clock', 'icon icon-sm')} ${Util.esc(a.appointment_time)}
        </div>
        <div class="meta">Reason: ${Util.esc(a.reason)}</div>
      </div>
      <div class="side">
        ${Render.statusBadge(a.status)}
        ${actions ? `<div class="btn-group">${actions}</div>` : ''}
      </div>
    </article>`;
  },

  /* A labelled read-only list for "view details" dialogs. */
  detailList(pairs) {
    return `<dl class="detail-list">${pairs
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `<dt>${Util.esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
  },

  /* Horizontal bar chart, pure CSS — no charting library to install. */
  bars(rows) {
    const max = Math.max(1, ...rows.map(r => r.count));
    return `<div class="bars">${rows.map(r => `
      <div class="bar-row">
        <span class="muted">${Util.esc(r.label)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${(r.count / max * 100).toFixed(1)}%"></span></span>
        <span class="count">${r.count}</span>
      </div>`).join('')}</div>`;
  }
};

/* ==========================================================================
   Form — validation helpers
   ========================================================================== */
const Form = {

  /* Reads every [data-field] input inside a scope into a plain object. */
  values(scope) {
    const out = {};
    scope.querySelectorAll('[data-field]').forEach(el => {
      out[el.dataset.field] = el.type === 'checkbox' ? el.checked : el.value.trim();
    });
    return out;
  },

  clearErrors(scope) {
    scope.querySelectorAll('.field.invalid').forEach(f => f.classList.remove('invalid'));
    const slot = scope.querySelector('.alert-slot');
    if (slot) slot.innerHTML = '';
  },

  fieldError(scope, fieldName, message) {
    const input = scope.querySelector(`[data-field="${fieldName}"]`);
    if (!input) return;
    const wrap = input.closest('.field');
    if (!wrap) return;
    wrap.classList.add('invalid');
    let err = wrap.querySelector('.field-error');
    if (!err) {
      err = document.createElement('div');
      err.className = 'field-error';
      wrap.appendChild(err);
    }
    err.textContent = message;
  },

  formError(scope, message) {
    const slot = scope.querySelector('.alert-slot');
    if (slot) {
      slot.innerHTML = `<div class="alert alert-error">${Icon.get('alert', 'icon icon-sm')}<span>${Util.esc(message)}</span></div>`;
    }
  },

  formSuccess(scope, message) {
    const slot = scope.querySelector('.alert-slot');
    if (slot) {
      slot.innerHTML = `<div class="alert alert-success">${Icon.get('check', 'icon icon-sm')}<span>${Util.esc(message)}</span></div>`;
    }
  },

  /**
   * Runs a rule list against values.
   * rules: [{ field, test(value, values), message }]
   * Returns true when everything passed.
   */
  validate(scope, values, rules) {
    Form.clearErrors(scope);
    let ok = true;
    let first = null;
    for (const rule of rules) {
      if (!rule.test(values[rule.field], values)) {
        Form.fieldError(scope, rule.field, rule.message);
        if (!first) first = rule.field;
        ok = false;
      }
    }
    if (!ok && first) {
      const el = scope.querySelector(`[data-field="${first}"]`);
      if (el) el.focus();
    }
    return ok;
  }
};

/* Common reusable rules. */
const Rules = {
  required: (field, label) => ({ field, test: v => !!v, message: `${label} is required.` }),
  email:    (field) => ({ field, test: v => Util.isEmail(v), message: 'Enter a valid email address.' }),
  minLen:   (field, n, label) => ({ field, test: v => (v || '').length >= n, message: `${label} must be at least ${n} characters.` }),
  matches:  (field, other, message) => ({ field, test: (v, all) => v === all[other], message }),
  phone:    (field) => ({ field, test: v => !v || /^[\d+\-\s()]{8,18}$/.test(v), message: 'Enter a valid phone number.' }),
  notPast:  (field) => ({ field, test: v => !!v && !Util.isPastDate(v), message: 'Choose today or a future date.' }),
  positive: (field, label) => ({ field, test: v => v !== '' && Number(v) >= 0, message: `${label} must be a positive number.` })
};
