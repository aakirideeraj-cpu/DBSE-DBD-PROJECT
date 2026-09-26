/* ==========================================================================
   MediBook — views.admin.js
   System-level management screens. These routes are registered only for the
   admin role in app.js, so a patient or doctor session never reaches them.
   ========================================================================== */

const AdminView = (() => {

  /* ======================================================================
     Dashboard
     ====================================================================== */
  async function dashboard(view) {
    view.innerHTML = Render.skeletonRows(3);
    const s = await Api.getAdminStats();

    view.innerHTML = `
      <div class="view-head">
        <h1>System overview</h1>
        <p>Everything registered in MediBook, across all doctors and patients.</p>
      </div>

      ${Render.statGrid([
        { value: s.patients, label: 'Registered patients' },
        { value: s.doctors, label: 'Active doctors' },
        { value: s.appointments.total, label: 'Total appointments' },
        { value: s.appointments.pending, label: 'Pending', tone: 'warn' },
        { value: s.appointments.completed, label: 'Completed', tone: 'done' },
        { value: s.appointments.cancelled, label: 'Cancelled', tone: 'bad' }
      ])}

      <div class="two-col mt-3">
        <section class="card">
          <div class="card-head">
            <h3>Appointments by specialization</h3>
            <button class="btn btn-ghost btn-sm" data-goto="appointments">Open list</button>
          </div>
          ${s.bySpecialization.length
            ? Render.bars(s.bySpecialization)
            : '<p class="small muted">No appointments recorded yet.</p>'}

          <hr class="rule">

          <div class="panel-title">Status breakdown</div>
          ${Render.bars([
            { label: 'Pending', count: s.appointments.pending },
            { label: 'Confirmed', count: s.appointments.confirmed },
            { label: 'Completed', count: s.appointments.completed },
            { label: 'Cancelled', count: s.appointments.cancelled }
          ])}
        </section>

        <aside class="stack">
          <section class="card">
            <div class="card-head"><h3>Recent activity</h3></div>
            <ul class="feed">
              ${s.activity.map(a => `
                <li>
                  ${Icon.get(a.icon, 'icon icon-sm')}
                  <div class="grow">
                    <div>${Util.esc(a.text)}</div>
                    <time>${Util.esc(a.when)}</time>
                  </div>
                </li>`).join('')}
            </ul>
            <p class="tiny faint mt-2">Sample activity feed. A real system would build this
               from an audit table or from record timestamps.</p>
          </section>

          <section class="card">
            <div class="card-head"><h3>Manage</h3></div>
            <div class="stack">
              <button class="btn btn-primary btn-block" data-goto="doctors">${Icon.get('stethoscope', 'icon icon-sm')} Doctors</button>
              <button class="btn btn-secondary btn-block" data-goto="patients">${Icon.get('users', 'icon icon-sm')} Patients</button>
              <button class="btn btn-secondary btn-block" data-goto="appointments">${Icon.get('calendar', 'icon icon-sm')} Appointments</button>
            </div>
          </section>
        </aside>
      </div>`;

    Util.onClick(view, '[data-goto]', el => App.go(el.dataset.goto));
  }

  /* ======================================================================
     Manage doctors
     ====================================================================== */
  async function doctors(view) {
    view.innerHTML = `
      <div class="view-head row-between wrap">
        <div>
          <h1>Doctors</h1>
          <p>Add practitioners, update their consultation details, or take them off the directory.</p>
        </div>
        <button class="btn btn-primary" id="add-doctor">${Icon.get('plus', 'icon icon-sm')} Add doctor</button>
      </div>

      <div class="toolbar">
        <div class="search">
          ${Icon.get('search')}
          <input type="search" id="q" placeholder="Search doctors by name or specialization" aria-label="Search doctors">
        </div>
        <select id="spec-filter" aria-label="Filter by specialization">
          <option value="">All specializations</option>
          ${SPECIALIZATIONS.map(s => `<option>${Util.esc(s)}</option>`).join('')}
        </select>
      </div>

      <div id="list" aria-live="polite"></div>`;

    const listEl = view.querySelector('#list');
    const qEl = view.querySelector('#q');
    const specEl = view.querySelector('#spec-filter');

    async function load() {
      listEl.innerHTML = Render.skeletonRows(4);
      const list = await Api.listDoctors({
        search: qEl.value,
        specialization: specEl.value,
        includeInactive: true
      });

      if (!list.length) {
        listEl.innerHTML = Render.empty({
          icon: 'stethoscope',
          title: 'No doctors match this search',
          message: 'Clear the filters, or add a new doctor to the directory.',
          action: '<button class="btn btn-primary btn-sm" id="add-doctor-empty">Add doctor</button>'
        });
        return;
      }

      listEl.innerHTML = `
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>Doctor</th><th>Specialization</th><th>Experience</th>
                <th>Fee</th><th>Availability</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${list.map(d => `
                <tr${d.is_active ? '' : ' style="opacity:.55"'}>
                  <td>
                    <div class="row">
                      <span class="avatar avatar-sm">${Util.esc(Util.initials(d.name))}</span>
                      <div>
                        <div class="strong">${Util.esc(d.name)}</div>
                        <div class="tiny muted">ID ${d.doctor_id}${d.is_active ? '' : ' · deactivated'}</div>
                      </div>
                    </div>
                  </td>
                  <td>${Util.esc(d.specialization)}</td>
                  <td class="num">${d.experience} yrs</td>
                  <td class="num">${Util.currency(d.consultation_fee)}</td>
                  <td>${d.is_active
                        ? Render.availabilityBadge(d.availability_status)
                        : '<span class="badge badge-inactive">Inactive</span>'}</td>
                  <td class="actions">
                    <button class="btn btn-secondary btn-sm" data-edit="${d.doctor_id}">Edit</button>
                    <button class="btn ${d.is_active ? 'btn-ghost' : 'btn-ok'} btn-sm"
                            data-toggle="${d.doctor_id}" data-active="${d.is_active}">
                      ${d.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    }

    /* One dialog handles both creating and editing. */
    function doctorForm(existing) {
      const d = existing || {
        name: '', specialization: SPECIALIZATIONS[0], experience: '', consultation_fee: '',
        availability_status: 'Available', email: '', phone: '', qualification: '', about: ''
      };

      Modal.open({
        title: existing ? 'Edit doctor' : 'Add a doctor',
        subtitle: existing ? `Doctor ID ${existing.doctor_id}` : 'Creates a new entry in the doctor directory',
        wide: true,
        body: `
          <div class="alert-slot"></div>

          <div class="form-grid">
            <div class="field">
              <label for="f-name">Full name</label>
              <input type="text" id="f-name" data-field="name" value="${Util.esc(d.name)}" placeholder="Dr. Meera Joshi">
              <div class="field-error"></div>
            </div>
            <div class="field">
              <label for="f-spec">Specialization</label>
              <select id="f-spec" data-field="specialization">
                ${SPECIALIZATIONS.map(s => `<option${s === d.specialization ? ' selected' : ''}>${Util.esc(s)}</option>`).join('')}
              </select>
              <div class="field-error"></div>
            </div>
          </div>

          <div class="form-grid">
            <div class="field">
              <label for="f-exp">Years of experience</label>
              <input type="number" id="f-exp" data-field="experience" min="0" max="60" value="${d.experience}">
              <div class="field-error"></div>
            </div>
            <div class="field">
              <label for="f-fee">Consultation fee (₹)</label>
              <input type="number" id="f-fee" data-field="consultation_fee" min="0" step="50" value="${d.consultation_fee}">
              <div class="field-error"></div>
            </div>
          </div>

          <div class="form-grid">
            <div class="field">
              <label for="f-email">Email</label>
              <input type="email" id="f-email" data-field="email" value="${Util.esc(d.email)}" placeholder="name@medibook.test">
              <div class="field-error"></div>
            </div>
            <div class="field">
              <label for="f-phone">Phone</label>
              <input type="tel" id="f-phone" data-field="phone" value="${Util.esc(d.phone)}">
              <div class="field-error"></div>
            </div>
          </div>

          <div class="form-grid">
            <div class="field">
              <label for="f-qual">Qualification</label>
              <input type="text" id="f-qual" data-field="qualification" value="${Util.esc(d.qualification)}" placeholder="MBBS, MD">
            </div>
            <div class="field">
              <label for="f-avail">Availability</label>
              <select id="f-avail" data-field="availability_status">
                ${AVAILABILITY_STATUSES.map(s => `<option${s === d.availability_status ? ' selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="field">
            <label for="f-about">About</label>
            <textarea id="f-about" data-field="about" rows="2">${Util.esc(d.about)}</textarea>
          </div>`,

        actions: [
          { label: 'Cancel', variant: 'secondary' },
          {
            label: existing ? 'Save changes' : 'Add doctor',
            variant: 'primary',
            onClick: async (scope) => {
              const v = Form.values(scope);
              const ok = Form.validate(scope, v, [
                Rules.required('name', 'Name'),
                Rules.positive('experience', 'Experience'),
                Rules.positive('consultation_fee', 'Consultation fee'),
                { field: 'email', test: x => !x || Util.isEmail(x), message: 'Enter a valid email address.' },
                Rules.phone('phone')
              ]);
              if (!ok) return false;

              try {
                if (existing) {
                  await Api.updateDoctor(existing.doctor_id, v);
                  Toast.ok(`${v.name} updated`);
                } else {
                  await Api.createDoctor(v);
                  Toast.ok(`${v.name} added to the directory`);
                }
                load();
              } catch (err) {
                Form.formError(scope, err.message);
                return false;
              }
            }
          }
        ]
      });
    }

    Util.onClick(view, '#add-doctor, #add-doctor-empty', () => doctorForm(null));
    Util.onClick(view, '[data-edit]', async el => doctorForm(await Api.getDoctor(el.dataset.edit)));

    Util.onClick(view, '[data-toggle]', async el => {
      const id = el.dataset.toggle;
      const isActive = el.dataset.active === 'true';
      const d = await Api.getDoctor(id);

      if (isActive) {
        const yes = await Modal.confirm({
          title: `Deactivate ${d.name}?`,
          message: 'They stop appearing in patient search and cannot take new bookings. Existing appointments and their history are kept, and you can reactivate them at any time.',
          confirmLabel: 'Deactivate',
          danger: true
        });
        if (!yes) return;
      }

      await Api.setDoctorActive(id, !isActive);
      Toast.ok(isActive ? `${d.name} deactivated` : `${d.name} reactivated`);
      load();
    });

    qEl.addEventListener('input', () => load());
    specEl.addEventListener('change', load);
    load();
  }

  /* ======================================================================
     Patients
     ====================================================================== */
  async function patients(view) {
    view.innerHTML = `
      <div class="view-head">
        <h1>Patients</h1>
        <p>Everyone registered in the system. Records are read-only from here.</p>
      </div>

      <div class="toolbar">
        <div class="search">
          ${Icon.get('search')}
          <input type="search" id="q" placeholder="Search by name, email or phone" aria-label="Search patients">
        </div>
      </div>

      <div id="list" aria-live="polite"></div>`;

    const listEl = view.querySelector('#list');
    const qEl = view.querySelector('#q');

    async function load() {
      listEl.innerHTML = Render.skeletonRows(4);
      const list = await Api.listPatients({ search: qEl.value });

      if (!list.length) {
        listEl.innerHTML = Render.empty({
          icon: 'users',
          title: 'No patients match that search',
          message: 'Search by full name, email address or phone number.'
        });
        return;
      }

      /* Appointment counts per patient, so the table says something useful. */
      const all = await Api.listAppointments({});
      const countFor = id => all.filter(a => a.patient_id === id).length;

      listEl.innerHTML = `
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr><th>Patient</th><th>Contact</th><th>Age</th><th>Registered</th><th>Appointments</th><th></th></tr>
            </thead>
            <tbody>
              ${list.map(p => `
                <tr>
                  <td>
                    <div class="row">
                      <span class="avatar avatar-sm">${Util.esc(Util.initials(`${p.first_name} ${p.last_name}`))}</span>
                      <div>
                        <div class="strong">${Util.esc(p.first_name)} ${Util.esc(p.last_name)}</div>
                        <div class="tiny muted">ID ${p.patient_id}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>${Util.esc(p.email)}</div>
                    <div class="tiny muted">${Util.esc(p.phone || 'No phone on file')}</div>
                  </td>
                  <td class="num">${Util.age(p.date_of_birth)}</td>
                  <td class="num">${Util.esc(Util.formatDateShort(p.registered_on))}</td>
                  <td class="num">${countFor(p.patient_id)}</td>
                  <td class="actions">
                    <button class="btn btn-secondary btn-sm" data-view="${p.patient_id}">View</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    }

    Util.onClick(view, '[data-view]', async el => {
      const id = Number(el.dataset.view);
      const [p, appts] = await Promise.all([
        Api.getPatient(id),
        Api.listAppointments({ patientId: id })
      ]);

      Modal.open({
        title: `${p.first_name} ${p.last_name}`,
        subtitle: `Patient ID ${p.patient_id}`,
        wide: true,
        body: `
          ${Render.detailList([
            ['Email', Util.esc(p.email)],
            ['Phone', Util.esc(p.phone || 'Not provided')],
            ['Date of birth', Util.esc(Util.formatDateShort(p.date_of_birth))],
            ['Age', Util.age(p.date_of_birth)],
            ['Blood group', Util.esc(p.blood_group || 'Not recorded')],
            ['Registered', Util.esc(Util.formatDateShort(p.registered_on))]
          ])}
          <hr class="rule">
          <div class="panel-title">Appointment history (${appts.length})</div>
          ${appts.length
            ? appts.slice(-5).reverse().map(a => `
                <div class="row-between" style="padding:8px 0;border-bottom:1px solid var(--line)">
                  <div>
                    <div class="strong small">${Util.esc(a.doctor_name)}</div>
                    <div class="tiny muted">${Util.esc(Util.formatDateShort(a.appointment_date))} at ${Util.esc(a.appointment_time)}</div>
                  </div>
                  ${Render.statusBadge(a.status)}
                </div>`).join('')
            : '<p class="small muted">No appointments booked yet.</p>'}`,
        actions: [{ label: 'Close', variant: 'secondary' }]
      });
    });

    qEl.addEventListener('input', () => load());
    load();
  }

  /* ======================================================================
     Appointments — system wide
     ====================================================================== */
  async function appointments(view) {
    const doctorList = await Api.listDoctors({ includeInactive: true });

    view.innerHTML = `
      <div class="view-head">
        <h1>Appointments</h1>
        <p>Every booking in the system. Status can be corrected here when a doctor cannot.</p>
      </div>

      <div class="toolbar">
        <div class="search">
          ${Icon.get('search')}
          <input type="search" id="q" placeholder="Search by patient or doctor" aria-label="Search appointments">
        </div>
        <select id="doctor-filter" aria-label="Filter by doctor">
          <option value="">All doctors</option>
          ${doctorList.map(d => `<option value="${d.doctor_id}">${Util.esc(d.name)}</option>`).join('')}
        </select>
        <select id="status-filter" aria-label="Filter by status">
          <option value="">All statuses</option>
          ${APPOINTMENT_STATUSES.map(s => `<option>${s}</option>`).join('')}
        </select>
        <input type="date" id="date-filter" aria-label="Filter by date" style="width:auto">
        <button class="btn btn-ghost btn-sm" id="reset">Reset</button>
      </div>

      <div id="list" aria-live="polite"></div>`;

    const listEl = view.querySelector('#list');
    const qEl = view.querySelector('#q');
    const docEl = view.querySelector('#doctor-filter');
    const statusEl = view.querySelector('#status-filter');
    const dateEl = view.querySelector('#date-filter');

    async function load() {
      listEl.innerHTML = Render.skeletonRows(4);
      let list = await Api.listAppointments({
        doctorId: docEl.value || undefined,
        status: statusEl.value || undefined,
        date: dateEl.value || undefined
      });

      const q = qEl.value.trim().toLowerCase();
      if (q) {
        list = list.filter(a =>
          a.patient_name.toLowerCase().includes(q) || a.doctor_name.toLowerCase().includes(q));
      }

      if (!list.length) {
        listEl.innerHTML = Render.empty({
          icon: 'calendar-off',
          title: 'No appointments match these filters',
          message: 'Reset the filters to see the full list again.'
        });
        return;
      }

      listEl.innerHTML = `
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr><th>#</th><th>Patient</th><th>Doctor</th><th>When</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              ${list.map(a => `
                <tr>
                  <td class="num muted">${a.appointment_id}</td>
                  <td class="strong">${Util.esc(a.patient_name)}</td>
                  <td>
                    <div>${Util.esc(a.doctor_name)}</div>
                    <div class="tiny muted">${Util.esc(a.specialization)}</div>
                  </td>
                  <td>
                    <div class="num">${Util.esc(Util.formatDateShort(a.appointment_date))}</div>
                    <div class="tiny muted">${Util.esc(a.appointment_time)}</div>
                  </td>
                  <td>${Render.statusBadge(a.status)}</td>
                  <td class="actions">
                    <button class="btn btn-secondary btn-sm" data-view="${a.appointment_id}">Details</button>
                    <button class="btn btn-ghost btn-sm" data-status="${a.appointment_id}">Change status</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="small muted mt-2">${list.length} ${list.length === 1 ? 'appointment' : 'appointments'} shown.</p>`;
    }

    async function findOne(id) {
      const all = await Api.listAppointments({});
      return all.find(a => a.appointment_id === Number(id));
    }

    Util.onClick(view, '[data-view]', async el => {
      const a = await findOne(el.dataset.view);
      Modal.open({
        title: 'Appointment details',
        subtitle: `Reference #${a.appointment_id}`,
        body: Render.detailList([
          ['Patient', Util.esc(a.patient_name)],
          ['Patient phone', Util.esc(a.patient_phone)],
          ['Doctor', Util.esc(a.doctor_name)],
          ['Specialization', Util.esc(a.specialization)],
          ['Date', Util.esc(Util.formatDate(a.appointment_date))],
          ['Time', Util.esc(a.appointment_time)],
          ['Reason', Util.esc(a.reason)],
          ['Fee', `<span class="num">${Util.currency(a.consultation_fee)}</span>`],
          ['Status', Render.statusBadge(a.status)],
          ['Booked on', Util.esc(Util.formatDateShort(a.booked_on))]
        ]),
        actions: [{ label: 'Close', variant: 'secondary' }]
      });
    });

    Util.onClick(view, '[data-status]', async el => {
      const a = await findOne(el.dataset.status);
      Modal.open({
        title: 'Change appointment status',
        subtitle: `${a.patient_name} with ${a.doctor_name}`,
        body: `
          <div class="alert-slot"></div>
          <div class="alert alert-warn">
            ${Icon.get('alert', 'icon icon-sm')}
            <span>Use this only to correct a record — for example when a doctor cannot mark a completed visit themselves.</span>
          </div>
          <div class="field">
            <label for="st">Status</label>
            <select id="st" data-field="status">
              ${APPOINTMENT_STATUSES.map(s => `<option${s === a.status ? ' selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>`,
        actions: [
          { label: 'Cancel', variant: 'secondary' },
          {
            label: 'Update status',
            variant: 'primary',
            onClick: async (scope) => {
              const status = scope.querySelector('#st').value;
              if (status === a.status) {
                Form.formError(scope, 'That is already the current status.');
                return false;
              }
              await Api.updateAppointmentStatus(a.appointment_id, status);
              Toast.ok(`Appointment #${a.appointment_id} set to ${status}`);
              load();
            }
          }
        ]
      });
    });

    Util.onClick(view, '#reset', () => {
      qEl.value = ''; docEl.value = ''; statusEl.value = ''; dateEl.value = '';
      load();
    });

    qEl.addEventListener('input', () => load());
    [docEl, statusEl, dateEl].forEach(el => el.addEventListener('change', load));
    load();
  }

  /* ======================================================================
     Admin profile
     ====================================================================== */
  async function profile(view) {
    const s = await Api.getAdminStats();

    view.innerHTML = `
      <div class="view-head">
        <h1>Administrator</h1>
        <p>Account details and a summary of what this role can reach.</p>
      </div>

      <div class="two-col">
        <section class="card">
          <div class="row mb-3">
            <span class="avatar avatar-lg" style="background:#e7e4f4;color:var(--role-admin)">
              ${Icon.get('shield', 'icon icon-lg')}
            </span>
            <div>
              <h3>${Util.esc(App.session.name)}</h3>
              <div class="small muted">${Util.esc(App.session.email)}</div>
            </div>
          </div>

          <hr class="rule">

          ${Render.detailList([
            ['Role', '<span class="badge badge-neutral">Administrator</span>'],
            ['Doctors managed', String(s.doctors)],
            ['Patients registered', String(s.patients)],
            ['Appointments on record', String(s.appointments.total)]
          ])}

          <hr class="rule">
          <p class="small muted">The administrator account is fixed in the demo data.
             In the real system it would be a row in a <code>users</code> table with a
             role column, created during database setup.</p>
        </section>

        <aside class="card">
          <div class="card-head"><h3>Permissions in this build</h3></div>
          <ul class="feed">
            <li>${Icon.get('check', 'icon icon-sm')}<span class="grow">Add, edit and deactivate doctors</span></li>
            <li>${Icon.get('check', 'icon icon-sm')}<span class="grow">View patient records and history</span></li>
            <li>${Icon.get('check', 'icon icon-sm')}<span class="grow">View and correct any appointment status</span></li>
            <li>${Icon.get('x', 'icon icon-sm')}<span class="grow muted">Cannot book on a patient's behalf</span></li>
            <li>${Icon.get('x', 'icon icon-sm')}<span class="grow muted">Cannot edit patient medical notes</span></li>
          </ul>
          <button class="btn btn-secondary btn-block mt-3" id="admin-logout">Log out</button>
        </aside>
      </div>`;

    view.querySelector('#admin-logout').addEventListener('click', () => App.logout());
  }

  return { dashboard, doctors, patients, appointments, profile };
})();
