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
    Api.logout();
    session = null;
    current = null;
    el.view.innerHTML = '';
    Modal.close();
    showPublic('home');
    Toast.show('Logged out. Session token cleared.');
  }

  function handleAuthFailure(message) {
    Api.clearToken();
    session = null;
    current = null;
    if (el.view) el.view.innerHTML = '';
    Modal.close();
    showPublic('login');
    Toast.bad(message || 'Session expired. Please log in again.');
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

    /* Microservices and Token explainer triggers */
    document.getElementById('btn-show-token-info')?.addEventListener('click', openTokenExplainerModal);
    document.getElementById('btn-header-microservices')?.addEventListener('click', openMicroservicesMonitorModal);
    document.getElementById('btn-footer-microservices')?.addEventListener('click', openMicroservicesMonitorModal);
    document.getElementById('btn-topbar-token')?.addEventListener('click', openTokenExplainerModal);
    document.getElementById('btn-topbar-microservices')?.addEventListener('click', openMicroservicesMonitorModal);
  }

  /* ======================================================================
     JWT Token Explainer Modal
     ====================================================================== */
  function openTokenExplainerModal() {
    const token = Api.getToken();
    const claims = Api.decodeToken(token);

    let tokenBody = '';
    if (token && claims) {
      const parts = token.split('.');
      const expDate = claims.exp ? new Date(claims.exp * 1000).toLocaleString('en-IN') : 'N/A';
      const iatDate = claims.iat ? new Date(claims.iat * 1000).toLocaleString('en-IN') : 'N/A';
      const timeLeftSec = claims.exp ? Math.max(0, Math.round(claims.exp - Date.now() / 1000)) : 0;
      const minsLeft = Math.floor(timeLeftSec / 60);

      tokenBody = `
        <div class="card card-tight mb-3" style="background:#0f172a;color:#e2e8f0;font-family:monospace;font-size:11.5px;overflow-x:auto;padding:12px;border-radius:6px;word-break:break-all;">
          <div style="color:#94a3b8;margin-bottom:4px">// Raw Encoded JWT (Header.Payload.Signature):</div>
          <span style="color:#f87171">${Util.esc(parts[0])}</span>.<span style="color:#60a5fa">${Util.esc(parts[1])}</span>.<span style="color:#34d399">${Util.esc(parts[2])}</span>
        </div>

        <div class="row-between mb-2">
          <span class="badge badge-available"><span class="dot"></span>Token Active (${minsLeft}m remaining)</span>
          <button class="btn btn-secondary btn-sm" id="btn-copy-jwt">Copy Token</button>
        </div>

        <div class="panel-title">Decoded JWT Payload (Claims)</div>
        <table class="table" style="font-size:12.5px;margin-bottom:12px">
          <tbody>
            <tr><td><strong>Subject ID (sub)</strong></td><td><code>${claims.id}</code></td></tr>
            <tr><td><strong>Role</strong></td><td><span class="badge badge-neutral">${claims.role}</span></td></tr>
            <tr><td><strong>User Name</strong></td><td>${Util.esc(claims.name || '—')}</td></tr>
            <tr><td><strong>Email</strong></td><td>${Util.esc(claims.email || '—')}</td></tr>
            <tr><td><strong>Issued At (iat)</strong></td><td>${iatDate}</td></tr>
            <tr><td><strong>Expires At (exp)</strong></td><td>${expDate}</td></tr>
            <tr><td><strong>Signing Algorithm</strong></td><td><code>HMAC-SHA256 (HS256)</code></td></tr>
          </tbody>
        </table>
      `;
    } else {
      tokenBody = `
        <div class="card card-tight mb-3" style="background:var(--navy-050);border-color:var(--navy-200);">
          <div class="small muted mb-1">Status: No active session token stored.</div>
          <p class="small mb-0">Log in with any account (e.g. Rahul Sharma under Demo Accounts) to inspect a live cryptographically generated JWT token.</p>
        </div>
      `;
    }

    Modal.open({
      title: 'JWT Tokenization Architecture',
      subtitle: 'Stateless Token-Based Authentication in MediBook',
      wide: true,
      body: `
        <div class="alert-slot"></div>
        <p class="small muted mb-3">
          <strong>Tokenization</strong> replaces traditional server-side session cookies with digitally signed <strong>JSON Web Tokens (JWT)</strong>.
          The client authenticates once with the <strong>Auth Microservice (Port 5001)</strong>, then transmits the signed bearer token in the <code>Authorization: Bearer &lt;token&gt;</code> header to the <strong>Appointment Microservice (Port 5002)</strong>.
        </p>

        <div class="card card-tight mb-3" style="background:var(--sunken);">
          <div style="font-weight:600;font-size:13px;margin-bottom:6px;">Three-Part Token Structure:</div>
          <div style="font-size:12px;line-height:1.5;">
            1. <strong style="color:#b91c1c">Header (Red):</strong> Declares signing algorithm (<code>HS256</code>) & token type (<code>JWT</code>).<br>
            2. <strong style="color:#1d4ed8">Payload (Blue):</strong> Cryptographically verified claims (Patient ID, Role, Email, Expiry).<br>
            3. <strong style="color:#047857">Signature (Green):</strong> Secret cryptographic hash ensuring tamper-proofing.
          </div>
        </div>

        ${tokenBody}

        <div class="panel-title mt-3">Microservices Security Contract</div>
        <p class="small muted mb-0">
          Because the <strong>Appointment Microservice</strong> verifies token signatures statelessly using the shared secret, it requires <strong>zero database queries</strong> and <strong>zero network calls</strong> to the Auth Service to authenticate each request!
        </p>
      `,
      actions: [
        { label: 'Close', variant: 'secondary' }
      ],
      onMount: (scope) => {
        const copyBtn = scope.querySelector('#btn-copy-jwt');
        if (copyBtn && token) {
          copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(token);
            copyBtn.textContent = 'Copied!';
            Toast.ok('JWT token copied to clipboard');
            setTimeout(() => { copyBtn.textContent = 'Copy Token'; }, 2000);
          });
        }
      }
    });
  }

  /* ======================================================================
     Microservices Topology & Circuit Breaker Monitor Modal
     ====================================================================== */
  async function openMicroservicesMonitorModal() {
    Modal.open({
      title: 'Microservices Topology & Resilience Monitor',
      subtitle: 'API Gateway & Circuit Breakers (Ports 5000, 5001, 5002)',
      wide: true,
      body: `
        <div id="ms-monitor-content">
          <p class="small muted">Querying Gateway & Microservices...</p>
        </div>
      `,
      actions: [
        { label: 'Close', variant: 'secondary' }
      ],
      onMount: async (scope) => {
        const container = scope.querySelector('#ms-monitor-content');

        async function refresh() {
          container.innerHTML = '<p class="small muted">Querying Gateway & Microservices...</p>';
          try {
            const [health, cb] = await Promise.all([
              Api.getMicroservicesHealth(),
              Api.getCircuitBreakers()
            ]);

            const gw = health.gateway || { status: 'running', port: 5000 };
            const services = health.services || [];
            const authSvc = services.find(s => s.name && s.name.includes('Auth')) || { status: 'unknown', latencyMs: 0 };
            const apptSvc = services.find(s => s.name && s.name.includes('Appointment')) || { status: 'unknown', latencyMs: 0 };

            const authCb = cb?.circuitBreakers?.authService || { state: 'CLOSED', failureCount: 0, failureThreshold: 3, successCount: 0 };
            const apptCb = cb?.circuitBreakers?.appointmentService || { state: 'CLOSED', failureCount: 0, failureThreshold: 3, successCount: 0 };

            container.innerHTML = `
              <div class="card card-tight mb-3" style="background:var(--navy-050);border-color:var(--navy-200);">
                <div class="row-between mb-1">
                  <strong>Concept 1: API Gateway Pattern (Port 5000)</strong>
                  <span class="badge badge-available"><span class="dot"></span>Reverse Proxy Active</span>
                </div>
                <p class="small muted mb-0">
                  Single entry point handling dynamic path routing, distributed request correlation tracing (<code>x-request-id</code>), and cross-cutting security.
                </p>
              </div>

              <div class="panel-title">Service Topology & Live Health</div>
              <div class="stat-grid mb-3" style="grid-template-columns:repeat(3, 1fr);">
                <div class="stat ${gw.status === 'running' ? 'is-ok' : 'is-bad'}">
                  <div class="stat-value" style="font-size:16px;">API Gateway</div>
                  <div class="stat-label">Port 5000 · <span class="badge badge-available">Running</span></div>
                </div>
                <div class="stat ${authSvc.status === 'running' ? 'is-ok' : 'is-bad'}">
                  <div class="stat-value" style="font-size:16px;">Auth Service</div>
                  <div class="stat-label">Port 5001 · ${authSvc.status === 'running' ? '<span class="badge badge-available">Online</span>' : '<span class="badge badge-cancelled">Offline</span>'}</div>
                  <div class="tiny muted mt-1">Latency: ${authSvc.latencyMs || 0}ms</div>
                </div>
                <div class="stat ${apptSvc.status === 'running' ? 'is-ok' : 'is-bad'}">
                  <div class="stat-value" style="font-size:16px;">Appointment Svc</div>
                  <div class="stat-label">Port 5002 · ${apptSvc.status === 'running' ? '<span class="badge badge-available">Online</span>' : '<span class="badge badge-cancelled">Offline</span>'}</div>
                  <div class="tiny muted mt-1">Latency: ${apptSvc.latencyMs || 0}ms</div>
                </div>
              </div>

              <div class="card card-tight mb-3" style="border-left:3px solid var(--accent);">
                <div class="row-between mb-2">
                  <strong>Concept 2: Circuit Breaker Pattern (Fault Tolerance)</strong>
                  <button class="btn btn-ghost btn-sm" id="btn-refresh-ms">🔄 Refresh</button>
                </div>
                <p class="small muted mb-2">
                  Protects against cascading system failures when a microservice slows down or fails. If errors reach threshold (3), the breaker trips to <strong>OPEN</strong>, failing fast without locking up gateway connection pools.
                </p>

                <table class="table" style="font-size:12.5px;">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Circuit State</th>
                      <th>Failures</th>
                      <th>Successes</th>
                      <th>Interactive Demo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Auth Service</strong></td>
                      <td>
                        <span class="badge ${authCb.state === 'CLOSED' ? 'badge-available' : authCb.state === 'OPEN' ? 'badge-cancelled' : 'badge-pending'}">
                          <span class="dot"></span>${authCb.state}
                        </span>
                      </td>
                      <td>${authCb.failureCount} / ${authCb.failureThreshold}</td>
                      <td>${authCb.successCount}</td>
                      <td>
                        ${authCb.state === 'CLOSED'
                          ? '<button class="btn btn-danger btn-sm" id="btn-trip-auth" style="padding:2px 8px;font-size:11px;">Trip Breaker</button>'
                          : '<button class="btn btn-ok btn-sm" id="btn-reset-auth" style="padding:2px 8px;font-size:11px;">Reset to CLOSED</button>'}
                      </td>
                    </tr>
                    <tr>
                      <td><strong>Appointment Service</strong></td>
                      <td>
                        <span class="badge ${apptCb.state === 'CLOSED' ? 'badge-available' : apptCb.state === 'OPEN' ? 'badge-cancelled' : 'badge-pending'}">
                          <span class="dot"></span>${apptCb.state}
                        </span>
                      </td>
                      <td>${apptCb.failureCount} / ${apptCb.failureThreshold}</td>
                      <td>${apptCb.successCount}</td>
                      <td>
                        ${apptCb.state === 'CLOSED'
                          ? '<button class="btn btn-danger btn-sm" id="btn-trip-appt" style="padding:2px 8px;font-size:11px;">Trip Breaker</button>'
                          : '<button class="btn btn-ok btn-sm" id="btn-reset-appt" style="padding:2px 8px;font-size:11px;">Reset to CLOSED</button>'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            `;

            scope.querySelector('#btn-refresh-ms')?.addEventListener('click', refresh);

            scope.querySelector('#btn-trip-auth')?.addEventListener('click', async () => {
              await Api.tripCircuitBreaker('auth');
              Toast.bad('Auth Service Circuit Breaker tripped to OPEN!');
              refresh();
            });

            scope.querySelector('#btn-reset-auth')?.addEventListener('click', async () => {
              await Api.resetCircuitBreaker('auth');
              Toast.ok('Auth Service Circuit Breaker reset to CLOSED');
              refresh();
            });

            scope.querySelector('#btn-trip-appt')?.addEventListener('click', async () => {
              await Api.tripCircuitBreaker('appointment');
              Toast.bad('Appointment Service Circuit Breaker tripped to OPEN!');
              refresh();
            });

            scope.querySelector('#btn-reset-appt')?.addEventListener('click', async () => {
              await Api.resetCircuitBreaker('appointment');
              Toast.ok('Appointment Service Circuit Breaker reset to CLOSED');
              refresh();
            });

          } catch (err) {
            container.innerHTML = `<div class="card card-tight" style="color:var(--bad-fg);">Microservices telemetry query note: ${Util.esc(err.message)}</div>`;
          }
        }

        refresh();
      }
    });
  }

  /* ======================================================================
     Boot
     ====================================================================== */
  async function init() {
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

    // Auto-restore session from stored JWT token
    const token = Api.getToken();
    if (token) {
      try {
        const verifiedUser = await Api.verifyToken();
        if (verifiedUser && verifiedUser.role) {
          enterApp(verifiedUser);
          Toast.ok(`Welcome back! Session restored via JWT token.`);
          return;
        }
      } catch (e) {
        Api.clearToken();
      }
    }

    showPublic('home');
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    go, logout, refreshIdentity, showPublic, handleAuthFailure,
    openTokenExplainerModal, openMicroservicesMonitorModal,
    get session() { return session; },
    set session(v) { session = v; },
    get current() { return current; }
  };
})();
