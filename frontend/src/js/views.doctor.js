/* ==========================================================================
   MediBook — views.doctor.js
   The doctor panel. Every query is scoped to App.session.id (the doctor_id),
   so a doctor only ever sees appointments assigned to them. There is no
   route here that reaches patient management or system statistics.
   ========================================================================== */

const DoctorView = (() => {

  /* Buttons a doctor may use, decided by the appointment's current status. */
  function actionsFor(a) {
    if (a.status === 'Pending') {
      return `<button class="btn btn-ok btn-sm" data-accept="${a.appointment_id}">Accept</button>
              <button class="btn btn-danger btn-sm" data-reject="${a.appointment_id}">Decline</button>`;
    }
    if (a.status === 'Confirmed') {
      return `<button class="btn btn-primary btn-sm" data-complete="${a.appointment_id}">Mark completed</button>
              <button class="btn btn-secondary btn-sm" data-notes="${a.appointment_id}">Patient</button>`;
    }
    return `<button class="btn btn-secondary btn-sm" data-notes="${a.appointment_id}">Patient</button>`;
  }

  /* One handler set, attached once per view, for all three status changes. */
  function wireStatusActions(view, reload) {
    Util.onClick(view, '[data-accept]', async el => {
      await Api.updateAppointmentStatus(el.dataset.accept, 'Confirmed');
      Toast.ok('Appointment confirmed');
      reload();
    });

    Util.onClick(view, '[data-reject]', async el => {
      const yes = await Modal.confirm({
        title: 'Decline this request?',
        message: 'The patient will see the appointment as cancelled and the slot becomes free again.',
        confirmLabel: 'Decline request',
        danger: true
      });
      if (!yes) return;
      await Api.updateAppointmentStatus(el.dataset.reject, 'Cancelled');
      Toast.ok('Request declined');
      reload();
    });

    Util.onClick(view, '[data-complete]', async el => {
      await Api.updateAppointmentStatus(el.dataset.complete, 'Completed');
      Toast.ok('Marked completed');
      reload();
    });

    Util.onClick(view, '[data-notes]', async el => {
      const list = await Api.listAppointments({ doctorId: App.session.id });
      const a = list.find(x => x.appointment_id === Number(el.dataset.notes));
      const patient = await Api.getPatient(a.patient_id);
      Modal.open({
        title: a.patient_name,
        subtitle: `Appointment #${a.appointment_id}`,
        body: Render.detailList([
          ['Age', Util.age(patient.date_of_birth)],
          ['Blood group', Util.esc(patient.blood_group || 'Not recorded')],
          ['Phone', Util.esc(patient.phone)],
          ['Email', Util.esc(patient.email)],
          ['Medical notes', Util.esc(patient.medical_notes || 'None recorded')],
          ['Visit date', Util.esc(Util.formatDate(a.appointment_date))],
          ['Time', Util.esc(a.appointment_time)],
          ['Reason', Util.esc(a.reason)],
          ['Status', Render.statusBadge(a.status)]
        ]),
        actions: [{ label: 'Close', variant: 'secondary' }]
      });
    });
  }

  /* ======================================================================
     Dashboard
     ====================================================================== */
  async function dashboard(view) {
    view.innerHTML = Render.skeletonRows(3);

    const [stats, all, me] = await Promise.all([
      Api.getDoctorStats(App.session.id),
      Api.listAppointments({ doctorId: App.session.id }),
      Api.getDoctor(App.session.id)
    ]);

    const today = Util.todayISO();
    const todays = all.filter(a => a.appointment_date === today && a.status !== 'Cancelled');
    const upcoming = all.filter(a => a.appointment_date > today && (a.status === 'Pending' || a.status === 'Confirmed')).slice(0, 4);
    const pending = all.filter(a => a.status === 'Pending');

    view.innerHTML = `
      <div class="view-head">
        <h1>Good day, ${Util.esc(me.name)}</h1>
        <p>${todays.length
            ? `You have ${todays.length} ${todays.length === 1 ? 'patient' : 'patients'} booked today.`
            : 'Nothing is booked for today.'}
           ${pending.length ? `${pending.length} ${pending.length === 1 ? 'request needs' : 'requests need'} your response.` : ''}</p>
      </div>

      ${Render.statGrid([
        { value: stats.total, label: 'Total appointments' },
        { value: stats.pending, label: 'Awaiting response', tone: 'warn' },
        { value: stats.confirmed, label: 'Confirmed', tone: 'ok' },
        { value: stats.completed, label: 'Completed', tone: 'done' }
      ])}

      <div class="two-col mt-3">
        <section class="card">
          <div class="card-head">
            <h3>Today's schedule</h3>
            <span class="small muted">${Util.esc(Util.formatDate(today))}</span>
          </div>
          <div id="today-list">
            ${todays.length
              ? todays.map(a => Render.appointment(a, { perspective: 'doctor', actions: actionsFor(a) })).join('')
              : Render.empty({
                  icon: 'calendar',
                  title: 'A clear day',
                  message: 'No appointments are booked for today.'
                })}
          </div>
        </section>

        <aside class="stack">
          <section class="card">
            <div class="card-head">
              <h3>Needs a decision</h3>
              ${pending.length ? `<span class="badge badge-pending">${pending.length}</span>` : ''}
            </div>
            ${pending.length
              ? `<p class="small muted mb-2">Patients are waiting on these requests.</p>
                 <button class="btn btn-primary btn-block" data-goto="appointments">Review requests</button>`
              : '<p class="small muted">Every request has been answered.</p>'}
          </section>

          <section class="card">
            <div class="card-head"><h3>Coming up</h3></div>
            ${upcoming.length
              ? `<ul class="feed">${upcoming.map(a => `
                  <li>
                    ${Icon.get('calendar', 'icon icon-sm')}
                    <div class="grow">
                      <div class="strong">${Util.esc(a.patient_name)}</div>
                      <time>${Util.esc(Util.formatDateShort(a.appointment_date))} at ${Util.esc(a.appointment_time)}</time>
                    </div>
                    ${Render.statusBadge(a.status)}
                  </li>`).join('')}</ul>`
              : '<p class="small muted">Nothing booked beyond today.</p>'}
          </section>
        </aside>
      </div>`;

    Util.onClick(view, '[data-goto]', el => App.go(el.dataset.goto));
    /* Re-enter through the router so the view node (and its listeners) is rebuilt. */
    wireStatusActions(view, () => App.go('dashboard'));
  }

  /* ======================================================================
     Appointments queue
     ====================================================================== */
  async function appointments(view) {
    view.innerHTML = `
      <div class="view-head">
        <h1>Appointments</h1>
        <p>Accept or decline new requests, and close out visits once they are done.</p>
      </div>

      <div class="toolbar">
        <div class="search">
          ${Icon.get('search')}
          <input type="search" id="q" placeholder="Search by patient name or reason" aria-label="Search appointments">
        </div>
        <input type="date" id="date-filter" aria-label="Filter by date" style="width:auto">
        <button class="btn btn-ghost btn-sm" id="clear-date">Clear date</button>
      </div>

      <div class="chips mb-3" id="status-chips">
        <button class="chip" data-status="" aria-pressed="true">All</button>
        ${APPOINTMENT_STATUSES.map(s => `<button class="chip" data-status="${s}" aria-pressed="false">${s}</button>`).join('')}
      </div>

      <div id="list" aria-live="polite"></div>`;

    const listEl = view.querySelector('#list');
    const qEl = view.querySelector('#q');
    const dateEl = view.querySelector('#date-filter');
    let status = '';

    async function load() {
      listEl.innerHTML = Render.skeletonRows(3);
      let list = await Api.listAppointments({
        doctorId: App.session.id,
        status: status || undefined,
        date: dateEl.value || undefined
      });

      const q = qEl.value.trim().toLowerCase();
      if (q) {
        list = list.filter(a =>
          a.patient_name.toLowerCase().includes(q) || a.reason.toLowerCase().includes(q));
      }

      if (!list.length) {
        listEl.innerHTML = Render.empty({
          icon: 'inbox',
          title: 'No appointments match these filters',
          message: 'Try clearing the status filter or picking a different date.',
          action: '<button class="btn btn-secondary btn-sm" id="reset">Clear all filters</button>'
        });
        return;
      }

      listEl.innerHTML = list
        .map(a => Render.appointment(a, { perspective: 'doctor', actions: actionsFor(a) }))
        .join('');
    }

    Util.onClick(view, '[data-status]', el => {
      status = el.dataset.status;
      view.querySelectorAll('#status-chips .chip').forEach(c => c.setAttribute('aria-pressed', String(c === el)));
      load();
    });

    Util.onClick(view, '#reset', () => {
      status = ''; qEl.value = ''; dateEl.value = '';
      view.querySelectorAll('#status-chips .chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.status === '')));
      load();
    });

    qEl.addEventListener('input', () => load());
    dateEl.addEventListener('change', load);
    view.querySelector('#clear-date').addEventListener('click', () => { dateEl.value = ''; load(); });

    wireStatusActions(view, load);
    load();
  }

  /* ======================================================================
     Schedule — availability status and consulting slots
     ====================================================================== */
  async function schedule(view) {
    view.innerHTML = Render.skeletonRows(3);
    const me = await Api.getDoctor(App.session.id);

    view.innerHTML = `
      <div class="view-head">
        <h1>My schedule</h1>
        <p>Turn slots on or off and set whether you are taking new bookings.</p>
      </div>

      <div class="two-col">
        <section class="card">
          <div class="card-head">
            <h3>Consulting slots</h3>
            <span class="small muted"><span id="slot-count">${me.slots.length}</span> active</span>
          </div>
          <p class="small muted mb-3">Only the slots selected here are offered to patients.
             Unselecting a slot does not affect appointments already booked in it.</p>
          <div class="chips" id="slot-chips">
            ${DEFAULT_SLOTS.map(s => `
              <button class="chip" data-slot="${s}" aria-pressed="${me.slots.includes(s)}">${s}</button>`).join('')}
          </div>
          <div class="btn-group mt-3">
            <button class="btn btn-primary" id="save-slots">Save slots</button>
            <button class="btn btn-ghost" id="select-all">Select all</button>
          </div>
        </section>

        <aside class="card">
          <div class="card-head"><h3>Booking status</h3></div>
          <div class="field">
            <label for="avail">Availability</label>
            <select id="avail">
              ${AVAILABILITY_STATUSES.map(s =>
                `<option${s === me.availability_status ? ' selected' : ''}>${s}</option>`).join('')}
            </select>
            <div class="hint">Patients can only book a doctor marked <strong>Available</strong>.</div>
          </div>
          <button class="btn btn-secondary btn-block" id="save-avail">Update status</button>

          <hr class="rule">
          <div class="panel-title">Right now</div>
          <div id="avail-preview">${Render.availabilityBadge(me.availability_status)}</div>
        </aside>
      </div>`;

    let slots = [...me.slots];

    Util.onClick(view, '[data-slot]', el => {
      const s = el.dataset.slot;
      const on = el.getAttribute('aria-pressed') === 'true';
      el.setAttribute('aria-pressed', String(!on));
      slots = on ? slots.filter(x => x !== s) : [...slots, s];
      slots.sort((a, b) => Util.timeToMinutes(a) - Util.timeToMinutes(b));
      view.querySelector('#slot-count').textContent = slots.length;
    });

    view.querySelector('#select-all').addEventListener('click', () => {
      slots = [...DEFAULT_SLOTS];
      view.querySelectorAll('[data-slot]').forEach(c => c.setAttribute('aria-pressed', 'true'));
      view.querySelector('#slot-count').textContent = slots.length;
    });

    view.querySelector('#save-slots').addEventListener('click', async () => {
      if (!slots.length) {
        Toast.bad('Keep at least one slot so patients can book.');
        return;
      }
      await Api.updateDoctor(App.session.id, { slots });
      Toast.ok('Slots saved');
    });

    view.querySelector('#save-avail').addEventListener('click', async () => {
      const value = view.querySelector('#avail').value;
      await Api.updateDoctor(App.session.id, { availability_status: value });
      view.querySelector('#avail-preview').innerHTML = Render.availabilityBadge(value);
      Toast.ok(`Status set to ${value}`);
    });
  }

  /* ======================================================================
     Profile — the consultation information patients see
     ====================================================================== */
  async function profile(view) {
    view.innerHTML = Render.skeletonRows(4);
    const me = await Api.getDoctor(App.session.id);
    const stats = await Api.getDoctorStats(App.session.id);

    view.innerHTML = `
      <div class="view-head">
        <h1>My profile</h1>
        <p>This is what patients see on your card when they search.</p>
      </div>

      <div class="card" style="max-width:620px" id="doc-form">
        <div class="row mb-3">
          <span class="avatar avatar-lg">${Util.esc(Util.initials(me.name))}</span>
          <div class="grow">
            <h3>${Util.esc(me.name)}</h3>
            <div class="small muted">${Util.esc(me.qualification || me.specialization)}</div>
            <div class="small muted">Doctor ID ${me.doctor_id} · ${stats.completed} consultations completed</div>
          </div>
        </div>

        <hr class="rule">
        <div class="alert-slot"></div>

        <p class="small muted mb-3">Your name and specialization are set by the administrator.
           You can update the consultation details below.</p>

        ${Render.detailList([
          ['Name', Util.esc(me.name)],
          ['Specialization', Util.esc(me.specialization)],
          ['Email', Util.esc(me.email)]
        ])}

        <hr class="rule">

        <div class="form-grid">
          <div class="field">
            <label for="d-exp">Years of experience</label>
            <input type="number" id="d-exp" data-field="experience" min="0" max="60" value="${me.experience}">
            <div class="field-error"></div>
          </div>
          <div class="field">
            <label for="d-fee">Consultation fee (₹)</label>
            <input type="number" id="d-fee" data-field="consultation_fee" min="0" step="50" value="${me.consultation_fee}">
            <div class="field-error"></div>
          </div>
        </div>

        <div class="field">
          <label for="d-qual">Qualification</label>
          <input type="text" id="d-qual" data-field="qualification" value="${Util.esc(me.qualification)}" placeholder="MBBS, MD">
          <div class="field-error"></div>
        </div>

        <div class="field">
          <label for="d-phone">Contact number</label>
          <input type="tel" id="d-phone" data-field="phone" value="${Util.esc(me.phone)}">
          <div class="field-error"></div>
        </div>

        <div class="field">
          <label for="d-about">About your practice</label>
          <textarea id="d-about" data-field="about" rows="3"
            placeholder="Conditions you treat most often">${Util.esc(me.about)}</textarea>
          <div class="hint">Shown in the details dialog on your doctor card.</div>
        </div>

        <div class="btn-group mt-2">
          <button class="btn btn-primary" id="save-doc">Save changes</button>
          <button class="btn btn-ghost" id="reset-doc">Discard</button>
        </div>
      </div>`;

    const form = view.querySelector('#doc-form');

    view.querySelector('#save-doc').addEventListener('click', async () => {
      const v = Form.values(form);
      const ok = Form.validate(form, v, [
        Rules.positive('experience', 'Experience'),
        Rules.positive('consultation_fee', 'Consultation fee'),
        Rules.phone('phone')
      ]);
      if (!ok) return;

      await Api.updateDoctor(me.doctor_id, v);
      Form.formSuccess(form, 'Profile saved.');
      Toast.ok('Profile saved');
    });

    view.querySelector('#reset-doc').addEventListener('click', () => App.go('profile'));
  }

  return { dashboard, appointments, schedule, profile };
})();
