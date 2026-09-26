/* ==========================================================================
   MediBook — app.js
   Session handling and role-based routing.

   ROUTES is the single source of truth for navigation: the sidebar, the
   topbar title and the screen that renders all come from the same entry.
   Adding a screen means adding one object to one array — the prototype
   needed an extra branch in an if/else chain for every page.

   A role can only reach the routes listed under its own key, so the UI
   never exposes another role's features.
   ========================================================================== */

const App = (() => {

  /* ======================================================================
     Route table
     ====================================================================== */
  const ROUTES = {
    patient: [
      { key: 'dashboard',    label: 'Dashboard',        icon: 'dashboard',      title: 'Dashboard',        render: PatientView.dashboard },
      { key: 'doctors',      label: 'Find doctors',     icon: 'search',         title: 'Find doctors',     render: PatientView.doctors },
      { key: 'book',         label: 'Book appointment', icon: 'calendar-plus',  title: 'Book appointment', render: PatientView.book },
      { key: 'appointments', label: 'My appointments',  icon: 'calendar',       title: 'My appointments',  render: PatientView.appointments },
      { key: 'profile',      label: 'Profile',          icon: 'user',           title: 'Profile',          render: PatientView.profile }
    ],
    doctor: [
      { key: 'dashboard',    label: 'Dashboard',    icon: 'dashboard',  title: 'Dashboard',    render: DoctorView.dashboard },
      { key: 'appointments', label: 'Appointments', icon: 'inbox',      title: 'Appointments', render: DoctorView.appointments, badge: 'pending' },
      { key: 'schedule',     label: 'Schedule',     icon: 'clock',      title: 'My schedule',  render: DoctorView.schedule },
      { key: 'profile',      label: 'Profile',      icon: 'user',       title: 'Profile',      render: DoctorView.profile }
    ],
    admin: [
      { key: 'dashboard',    label: 'Dashboard',    icon: 'dashboard',    title: 'System overview', render: AdminView.dashboard },
      { key: 'doctors',      label: 'Doctors',      icon: 'stethoscope',  title: 'Doctors',         render: AdminView.doctors },
      { key: 'patients',     label: 'Patients',     icon: 'users',        title: 'Patients',        render: AdminView.patients },
      { key: 'appointments', label: 'Appointments', icon: 'calendar',     title: 'Appointments',    render: AdminView.appointments },
      { key: 'profile',      label: 'Profile',      icon: 'shield',       title: 'Administrator',   render: AdminView.profile }
    ]
  };

  const ROLE_LABEL = { patient: 'Patient panel', doctor: 'Doctor panel', admin: 'Admin panel' };
  /* The sidebar is dark navy, so the role accent has to be a light tint to
     read against it — the deep --role-* values would disappear. */
  const ROLE_ACCENT = { patient: '#7fb0e8', doctor: '#5fc0b8', admin: '#a396dd' };

  let session = null;
  let current = null;

  /* Elements, cached on boot. */
  const el = {};

  /* ======================================================================
     Public screens
     ====================================================================== */
  function showPublic(screen) {
    document.getElementById('app-shell').classList.remove('active');
    document.getElementById('public-site').style.display = '';
    document.querySelectorAll('#public-site .screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + screen).classList.add('active');
    el.header.classList.remove('nav-open');
    el.navToggle.setAttribute('aria-expanded', 'false');

    /* Only the landing page keeps the marketing nav highlighted. */
    document.querySelectorAll('#site-nav a').forEach(a =>
      a.classList.toggle('active', screen === 'home' && a.dataset.goPublic === 'home'));

    window.scrollTo(0, 0);
  }

  /* ======================================================================
     Session
     ====================================================================== */
  function enterApp(newSession) {
    session = newSession;
    document.getElementById('public-site').style.display = 'none';
    document.getElementById('app-shell').classList.add('active');
    document.documentElement.style.setProperty('--accent', ROLE_ACCENT[session.role]);
    buildSidebar();
    refreshIdentity();
    go(ROUTES[session.role][0].key);
  }

  function logout() {
    session = null;
    current = null;
    el.view.innerHTML = '';
    Modal.close();
    showPublic('home');
    Toast.show('Logged out');
  }

  /* Called after a profile edit changes the display name. */
  function refreshIdentity() {
    if (!session) return;
    el.topbarName.textContent = session.name;
    el.topbarRole.textContent = ROLE_LABEL[session.role];
    el.topbarAvatar.textContent = Util.initials(session.name);
    el.sidebarRole.innerHTML =
      `<span class="dot" style="background:${ROLE_ACCENT[session.role]}"></span>${ROLE_LABEL[session.role]}`;
  }

  /* ======================================================================
     Sidebar + routing
     ====================================================================== */
  function buildSidebar() {
    el.sideNav.innerHTML = ROUTES[session.role].map(r => `
      <button data-route="${r.key}">
        ${Icon.get(r.icon, 'icon icon-sm')}
        <span class="grow">${r.label}</span>
        ${r.badge ? `<span class="badge-count hidden" data-badge="${r.key}"></span>` : ''}
      </button>`).join('');
    updateBadges();
  }

  /* The doctor's Appointments item shows how many requests are waiting. */
  async function updateBadges() {
    if (!session || session.role !== 'doctor') return;
    const pending = await Api.listAppointments({ doctorId: session.id, status: 'Pending' });
    const badge = el.sideNav.querySelector('[data-badge="appointments"]');
    if (!badge) return;
    badge.textContent = pending.length;
    badge.classList.toggle('hidden', pending.length === 0);
  }

  /* Each screen attaches delegated listeners to the view container. If the
     same node were reused, those listeners would pile up and a click on one
     screen could trigger a handler belonging to a screen you left minutes ago.
     Swapping in a fresh node throws the old listeners away with it. */
  function resetViewNode() {
    const fresh = document.createElement('main');
    fresh.className = 'view';
    fresh.id = 'view';
    fresh.setAttribute('aria-live', 'polite');
    el.view.replaceWith(fresh);
    el.view = fresh;
  }

  async function go(key) {
    if (!session) return;
    const route = ROUTES[session.role].find(r => r.key === key);
    if (!route) {
      /* A role asking for a screen it does not own falls back to its dashboard. */
      return go(ROUTES[session.role][0].key);
    }

    current = key;
    resetViewNode();
    el.topbarTitle.textContent = route.title;
    el.sideNav.querySelectorAll('button').forEach(b =>
      b.classList.toggle('active', b.dataset.route === key));
    closeDrawer();

    try {
      await route.render(el.view);
    } catch (err) {
      console.error(err);
      el.view.innerHTML = Render.empty({
        icon: 'alert',
        title: 'This screen could not load',
        message: 'Reload the page to try again. Details are in the browser console.'
      });
    }
    updateBadges();
    window.scrollTo(0, 0);
  }

  function openDrawer() {
    el.sidebar.classList.add('open');
    el.scrim.classList.add('open');
  }
  function closeDrawer() {
    el.sidebar.classList.remove('open');
    el.scrim.classList.remove('open');
  }

  /* ======================================================================
     Landing page content
     ====================================================================== */
  const FEATURES = [
    { icon: 'search',        title: 'Doctor discovery', text: 'Filter by specialization, compare fees and experience, and see who is taking bookings today.' },
    { icon: 'calendar-plus', title: 'Slot booking',     text: 'Pick a free time from the doctor\'s own consulting hours. Slots already taken are never offered.' },
    { icon: 'clipboard',     title: 'Request handling', text: 'Bookings arrive as requests. The doctor confirms, declines, or marks the visit completed.' },
    { icon: 'chart',         title: 'Administration',   text: 'One place to manage the doctor directory, review patients, and audit every appointment.' }
  ];

  const PANELS = [
    { cls: '', role: 'Patient', icon: 'user',
      items: ['Search and compare doctors', 'Book and cancel appointments', 'Track upcoming and past visits', 'Keep contact and medical details current'] },
    { cls: 'doctor', role: 'Doctor', icon: 'stethoscope',
      items: ['See today\'s schedule at a glance', 'Accept or decline requests', 'Mark visits completed', 'Set consulting hours and availability'] },
    { cls: 'admin', role: 'Administrator', icon: 'shield',
      items: ['Add and edit doctors', 'Deactivate a doctor without losing history', 'Browse the patient register', 'Filter and correct any appointment'] }
  ];

  async function buildLanding() {
    document.getElementById('brand-mark').innerHTML = Icon.get('activity', 'icon icon-sm');
    document.getElementById('sidebar-mark').innerHTML = Icon.get('activity', 'icon icon-sm');
    document.getElementById('logout-icon').innerHTML = Icon.get('logout', 'icon icon-sm');
    document.getElementById('nav-toggle').innerHTML = Icon.get('menu');
    document.getElementById('sidebar-toggle').innerHTML = Icon.get('menu');
    document.getElementById('public-search-icon').outerHTML = Icon.get('search');

    document.getElementById('feature-grid').innerHTML = FEATURES.map(f => `
      <article class="feature">
        ${Icon.get(f.icon, 'icon icon-lg')}
        <h3>${f.title}</h3>
        <p>${f.text}</p>
      </article>`).join('');

    document.getElementById('role-grid').innerHTML = PANELS.map(p => `
      <article class="role-card ${p.cls}">
        <div class="row mb-2">${Icon.get(p.icon, 'icon icon-lg')}<h3>${p.role}</h3></div>
        <ul>${p.items.map(i => `<li>${i}</li>`).join('')}</ul>
        <button class="btn btn-secondary btn-sm btn-block" data-go-public="login">Open the ${p.role.toLowerCase()} demo</button>
      </article>`).join('');

    /* Demo account switcher on the login screen. */
    document.getElementById('demo-account-list').innerHTML = DEMO_ACCOUNTS.map(a => `
      <button class="btn btn-secondary btn-block" data-demo="${Util.esc(a.email)}" style="justify-content:flex-start;text-align:left">
        ${Icon.get(a.role === 'admin' ? 'shield' : a.role === 'doctor' ? 'stethoscope' : 'user', 'icon icon-sm')}
        <span class="grow">
          <span class="strong" style="text-transform:capitalize">${a.role}</span>
          <span class="tiny muted" style="display:block">${Util.esc(a.email)}</span>
        </span>
      </button>`).join('');

    /* Public doctor directory. */
    const chips = document.getElementById('public-spec-chips');
    chips.innerHTML = `<button class="chip" data-pspec="" aria-pressed="true">All</button>` +
      SPECIALIZATIONS.map(s => `<button class="chip" data-pspec="${Util.esc(s)}" aria-pressed="false">${Util.esc(s)}</button>`).join('');

    const listEl = document.getElementById('public-doctor-list');
    const searchEl = document.getElementById('public-doctor-search');
    let pspec = '';

    async function loadPublicDoctors() {
      listEl.innerHTML = Render.skeletonCards(3);
      const list = await Api.listDoctors({ search: searchEl.value, specialization: pspec });
      if (!list.length) {
        listEl.innerHTML = Render.empty({
          icon: 'search',
          title: 'No doctors match that search',
          message: 'Try another name or clear the specialization filter.'
        });
        return;
      }
      listEl.innerHTML = list.map(d => `
        <article class="doctor-card">
          <div class="doctor-top">
            <span class="avatar">${Util.esc(Util.initials(d.name))}</span>
            <div class="grow">
              <div class="name">${Util.esc(d.name)}</div>
              <div class="spec">${Util.esc(d.specialization)}</div>
            </div>
          </div>
          <dl class="doctor-facts">
            <dt>Experience</dt><dd>${d.experience} years</dd>
            <dt>Fee</dt><dd class="num">${Util.currency(d.consultation_fee)}</dd>
            <dt>Status</dt><dd>${Render.availabilityBadge(d.availability_status)}</dd>
          </dl>
          <button class="btn btn-secondary btn-sm btn-block" data-go-public="login">Log in to book</button>
        </article>`).join('');
    }

    Util.onClick(chips, '[data-pspec]', b => {
      pspec = b.dataset.pspec;
      chips.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
      loadPublicDoctors();
    });

    let t;
    searchEl.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(loadPublicDoctors, 220);
    });

    loadPublicDoctors();
  }

  /* ======================================================================
     Login / register wiring
     ====================================================================== */
  function wireAuth() {
    const loginForm = document.getElementById('login-form');

    async function submitLogin() {
      const v = Form.values(loginForm);
      const ok = Form.validate(loginForm, v, [
        Rules.required('email', 'Email address'),
        Rules.required('password', 'Password')
      ]);
      if (!ok) return;

      const btn = document.getElementById('login-submit');
      btn.disabled = true;
      btn.textContent = 'Checking…';

      try {
        const s = await Api.login(v.email, v.password);
        enterApp(s);
        Toast.ok(`Signed in as ${s.name}`);
      } catch (err) {
        Form.formError(loginForm, err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Log in';
      }
    }

    document.getElementById('login-submit').addEventListener('click', submitLogin);
    loginForm.addEventListener('keydown', e => { if (e.key === 'Enter') submitLogin(); });

    Util.onClick(document.getElementById('demo-account-list'), '[data-demo]', b => {
      const account = DEMO_ACCOUNTS.find(a => a.email === b.dataset.demo);
      document.getElementById('login-email').value = account.email;
      document.getElementById('login-password').value = account.password;
      Form.clearErrors(loginForm);
      document.getElementById('login-submit').focus();
    });

    /* ---- Register ---- */
    const registerForm = document.getElementById('register-form');

    async function submitRegister() {
      const v = Form.values(registerForm);
      const ok = Form.validate(registerForm, v, [
        Rules.required('first_name', 'First name'),
        Rules.required('last_name', 'Last name'),
        Rules.email('email'),
        Rules.phone('phone'),
        Rules.minLen('password', 6, 'Password'),
        Rules.matches('confirm_password', 'password', 'The two passwords do not match.')
      ]);
      if (!ok) return;

      const btn = document.getElementById('register-submit');
      btn.disabled = true;
      btn.textContent = 'Creating account…';

      try {
        const s = await Api.registerPatient(v);
        enterApp(s);
        Toast.ok(`Account created. Welcome, ${v.first_name}.`);
      } catch (err) {
        Form.formError(registerForm, err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Create account';
      }
    }

    document.getElementById('register-submit').addEventListener('click', submitRegister);
    registerForm.addEventListener('keydown', e => { if (e.key === 'Enter') submitRegister(); });
  }

  /* ======================================================================
     Boot
     ====================================================================== */
  function init() {
    el.header      = document.getElementById('site-header');
    el.navToggle   = document.getElementById('nav-toggle');
    el.sidebar     = document.getElementById('sidebar');
    el.sideNav     = document.getElementById('side-nav');
    el.sidebarRole = document.getElementById('sidebar-role');
    el.scrim       = document.getElementById('scrim');
    el.view        = document.getElementById('view');
    el.topbarTitle = document.getElementById('topbar-title');
    el.topbarName  = document.getElementById('topbar-name');
    el.topbarRole  = document.getElementById('topbar-role');
    el.topbarAvatar= document.getElementById('topbar-avatar');

    buildLanding();
    wireAuth();

    /* Public navigation, delegated from the document so it also works for
       buttons that are generated later. */
    Util.onClick(document, '[data-go-public]', b => showPublic(b.dataset.goPublic));

    Util.onClick(document, '[data-scroll]', b => {
      showPublic('home');
      const target = document.getElementById(b.dataset.scroll);
      if (target) setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    });

    el.navToggle.addEventListener('click', () => {
      const open = el.header.classList.toggle('nav-open');
      el.navToggle.setAttribute('aria-expanded', String(open));
    });

    /* Dashboard navigation. */
    Util.onClick(el.sideNav, '[data-route]', b => go(b.dataset.route));
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('sidebar-toggle').addEventListener('click', openDrawer);
    el.scrim.addEventListener('click', closeDrawer);

    showPublic('home');
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    go, logout, refreshIdentity, showPublic,
    get session() { return session; },
    set session(v) { session = v; },
    get current() { return current; }
  };
})();
