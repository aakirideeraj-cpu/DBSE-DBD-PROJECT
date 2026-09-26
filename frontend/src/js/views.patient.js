/* ==========================================================================
   MediBook — views.patient.js
   The five screens a logged-in patient can reach. Each render function
   receives the <main id="view"> element and fills it.
   A patient only ever queries appointments with their own patient_id.
   ========================================================================== */

const PatientView = (() => {

  /* ======================================================================
     Booking dialog — shared by the doctor cards and the booking screen.
     ====================================================================== */
  async function openBookingDialog(doctorId, onBooked) {
    const doctor = await Api.getDoctor(doctorId);

    Modal.open({
      title: 'Book an appointment',
      subtitle: `${doctor.name} · ${doctor.specialization}`,
      body: `
        <div class="alert-slot"></div>

        <div class="card card-tight mb-3" style="background:var(--navy-050);border-color:var(--navy-100)">
          ${Render.detailList([
            ['Experience', `${doctor.experience} years`],
            ['Consultation fee', `<span class="num">${Util.currency(doctor.consultation_fee)}</span>`],
            ['Status', Render.availabilityBadge(doctor.availability_status)]
          ])}
        </div>

        <div class="field">
          <label for="bk-date">Appointment date</label>
          <input type="date" id="bk-date" data-field="appointment_date" min="${Util.todayISO()}">
          <div class="field-error"></div>
        </div>

        <div class="field">
          <label for="bk-time">Time slot</label>
          <select id="bk-time" data-field="appointment_time">
            <option value="">Choose a date first</option>
          </select>
          <div class="hint">Slots already taken for the chosen date are hidden.</div>
          <div class="field-error"></div>
        </div>

        <div class="field">
          <label for="bk-reason">Reason for visit</label>
          <textarea id="bk-reason" data-field="reason" rows="2" placeholder="Briefly describe your symptoms"></textarea>
          <div class="hint">Optional. Helps the doctor prepare.</div>
        </div>

        <p class="tiny muted">The booking is created with status <strong>Pending</strong>.
           ${Util.esc(doctor.name)} confirms or declines it from the doctor panel.</p>`,

      actions: [
        { label: 'Cancel', variant: 'secondary' },
        {
          label: 'Book appointment',
          variant: 'primary',
          onClick: async (scope) => {
            const v = Form.values(scope);
            const ok = Form.validate(scope, v, [
              Rules.required('appointment_date', 'Date'),
              Rules.notPast('appointment_date'),
              Rules.required('appointment_time', 'Time slot')
            ]);
            if (!ok) return false;

            try {
              await Api.createAppointment({
                patient_id: App.session.id,
                doctor_id: doctor.doctor_id,
                appointment_date: v.appointment_date,
                appointment_time: v.appointment_time,
                reason: v.reason
              });
              Toast.ok(`Requested ${Util.formatDateShort(v.appointment_date)} at ${v.appointment_time}`);
              if (onBooked) onBooked();
            } catch (err) {
              Form.formError(scope, err.message);
              return false;
            }
          }
        }
      ],

      onMount: (scope) => {
        const dateEl = scope.querySelector('#bk-date');
        const timeEl = scope.querySelector('#bk-time');

        async function loadSlots() {
          if (!dateEl.value) {
            timeEl.innerHTML = '<option value="">Choose a date first</option>';
            return;
          }
          timeEl.innerHTML = '<option value="">Loading slots…</option>';
          const slots = await Api.getAvailableSlots(doctor.doctor_id, dateEl.value);
          const free = slots.filter(s => !s.taken);
          timeEl.innerHTML = free.length
            ? '<option value="">Select a time</option>' +
              free.map(s => `<option value="${s.time}">${s.time}</option>`).join('')
            : '<option value="">No slots left on this date</option>';
        }

        dateEl.addEventListener('change', loadSlots);
      }
    });
  }

  /* ======================================================================
     Dashboard
     ====================================================================== */
  async function dashboard(view) {
    view.innerHTML = Render.skeletonRows(3);

    const [stats, appointments] = await Promise.all([
      Api.getPatientStats(App.session.id),
      Api.listAppointments({ patientId: App.session.id })
    ]);

    const today = Util.todayISO();
    const upcoming = appointments.filter(
      a => a.appointment_date >= today && (a.status === 'Pending' || a.status === 'Confirmed')
    );
    const recent = [...appointments].reverse().slice(0, 4);
    const firstName = App.session.name.split(' ')[0];

    view.innerHTML = `
      <div class="view-head">
        <h1>Welcome back, ${Util.esc(firstName)}</h1>
        <p>${upcoming.length
            ? `Your next appointment is ${Util.esc(Util.relativeDay(upcoming[0].appointment_date).toLowerCase())} with ${Util.esc(upcoming[0].doctor_name)}.`
            : 'You have nothing scheduled. Find a doctor to book your first slot.'}</p>
      </div>

      ${Render.statGrid([
        { value: stats.total, label: 'Total appointments' },
        { value: upcoming.length, label: 'Upcoming', tone: 'ok' },
        { value: stats.completed, label: 'Completed', tone: 'done' },
        { value: stats.cancelled, label: 'Cancelled', tone: 'bad' }
      ])}

      <div class="two-col mt-3">
        <section class="card">
          <div class="card-head">
            <h3>Recent appointments</h3>
            <button class="btn btn-ghost btn-sm" data-goto="appointments">View all</button>
          </div>
          <div id="recent-list">
            ${recent.length
              ? recent.map(a => Render.appointment(a, { perspective: 'patient' })).join('')
              : Render.empty({
                  icon: 'calendar-off',
                  title: 'No appointments yet',
                  message: 'Once you book a slot it will appear here.'
                })}
          </div>
        </section>

        <aside class="stack">
          <section class="card">
            <div class="card-head"><h3>Quick actions</h3></div>
            <div class="stack">
              <button class="btn btn-primary btn-block" data-goto="doctors">
                ${Icon.get('search', 'icon icon-sm')} Find a doctor
              </button>
              <button class="btn btn-secondary btn-block" data-goto="book">
                ${Icon.get('calendar-plus', 'icon icon-sm')} Book an appointment
              </button>
              <button class="btn btn-secondary btn-block" data-goto="profile">
                ${Icon.get('user', 'icon icon-sm')} Update my profile
              </button>
            </div>
          </section>

          <section class="card">
            <div class="card-head"><h3>Pending confirmation</h3></div>
            ${stats.pending
              ? `<p class="small muted">You have <strong>${stats.pending}</strong>
                 ${stats.pending === 1 ? 'request' : 'requests'} waiting for a doctor to respond.
                 You can cancel a request at any time before it is confirmed.</p>`
              : '<p class="small muted">Nothing is waiting on a doctor right now.</p>'}
          </section>
        </aside>
      </div>`;

    Util.onClick(view, '[data-goto]', el => App.go(el.dataset.goto));
  }

  /* ======================================================================
     Find doctors
     ====================================================================== */
  async function doctors(view) {
    view.innerHTML = `
      <div class="view-head">
        <h1>Find a doctor</h1>
        <p>Search by name or specialization, then book a slot directly from a card.</p>
      </div>

      <div class="toolbar">
        <div class="search">
          ${Icon.get('search')}
          <input type="search" id="doc-search" placeholder="Search by name or specialization" aria-label="Search doctors">
        </div>
        <select id="doc-sort" aria-label="Sort doctors">
          <option value="name">Sort by name</option>
          <option value="fee">Lowest fee first</option>
          <option value="experience">Most experienced first</option>
        </select>
      </div>

      <div class="chips mb-3" id="spec-chips">
        <button class="chip" data-spec="" aria-pressed="true">All specializations</button>
        ${SPECIALIZATIONS.map(s => `<button class="chip" data-spec="${Util.esc(s)}" aria-pressed="false">${Util.esc(s)}</button>`).join('')}
      </div>

      <div id="doctor-list" class="doctor-grid" aria-live="polite"></div>`;

    const listEl = view.querySelector('#doctor-list');
    const searchEl = view.querySelector('#doc-search');
    const sortEl = view.querySelector('#doc-sort');
    let spec = '';

    async function load() {
      listEl.innerHTML = Render.skeletonCards(3);
      const list = await Api.listDoctors({ search: searchEl.value, specialization: spec });

      const sorters = {
        name: (a, b) => a.name.localeCompare(b.name),
        fee: (a, b) => a.consultation_fee - b.consultation_fee,
        experience: (a, b) => b.experience - a.experience
      };
      list.sort(sorters[sortEl.value]);

      if (!list.length) {
        listEl.innerHTML = Render.empty({
          icon: 'search',
          title: 'No doctors match that search',
          message: 'Try a different name, or clear the specialization filter.',
          action: '<button class="btn btn-secondary btn-sm" data-reset>Clear filters</button>'
        });
        return;
      }
      listEl.innerHTML = list.map(card).join('');
    }

    function card(d) {
      const bookable = d.availability_status === 'Available';
      return `<article class="doctor-card">
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
        <div class="btn-group">
          <button class="btn btn-primary btn-sm grow" data-book="${d.doctor_id}" ${bookable ? '' : 'disabled'}>
            ${bookable ? 'Book appointment' : 'Not taking bookings'}
          </button>
          <button class="btn btn-secondary btn-sm" data-details="${d.doctor_id}">Details</button>
        </div>
      </article>`;
    }

    searchEl.addEventListener('input', debounce(load, 220));
    sortEl.addEventListener('change', load);

    Util.onClick(view, '.chip', el => {
      spec = el.dataset.spec;
      view.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c === el)));
      load();
    });

    Util.onClick(view, '[data-book]', el => openBookingDialog(el.dataset.book, () => App.go('appointments')));
    Util.onClick(view, '[data-details]', el => showDoctorDetails(el.dataset.details));
    Util.onClick(view, '[data-reset]', () => {
      searchEl.value = '';
      spec = '';
      view.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.spec === '')));
      load();
    });

    load();
  }

  async function showDoctorDetails(doctorId) {
    const d = await Api.getDoctor(doctorId);
    Modal.open({
      title: d.name,
      subtitle: d.qualification || d.specialization,
      body: `
        ${d.about ? `<p class="small muted mb-3">${Util.esc(d.about)}</p>` : ''}
        ${Render.detailList([
          ['Specialization', Util.esc(d.specialization)],
          ['Experience', `${d.experience} years`],
          ['Consultation fee', `<span class="num">${Util.currency(d.consultation_fee)}</span>`],
          ['Availability', Render.availabilityBadge(d.availability_status)],
          ['Consulting hours', d.slots.map(s => Util.esc(s)).join(', ')]
        ])}`,
      actions: [
        { label: 'Close', variant: 'secondary' },
        {
          label: 'Book appointment',
          variant: 'primary',
          onClick: () => {
            if (d.availability_status !== 'Available') {
              Toast.bad(`${d.name} is not taking bookings right now.`);
              return;
            }
            setTimeout(() => openBookingDialog(d.doctor_id, () => App.go('appointments')), 120);
          }
        }
      ]
    });
  }

  /* ======================================================================
     Book appointment (form-first route to the same dialog)
     ====================================================================== */
  async function book(view) {
    view.innerHTML = `
      <div class="view-head">
        <h1>Book an appointment</h1>
        <p>Pick a doctor, choose a free slot, and send the request.</p>
      </div>
      <div class="card" style="max-width:520px" id="book-panel">
        <div class="alert-slot"></div>
        <div class="field">
          <label for="pick-doctor">Doctor</label>
          <select id="pick-doctor" data-field="doctor_id"><option value="">Loading doctors…</option></select>
          <div class="field-error"></div>
        </div>
        <div id="doctor-preview"></div>
        <button class="btn btn-primary btn-block mt-2" id="continue-booking">Choose a date and time</button>
        <hr class="rule">
        <p class="small muted">Prefer to browse first?
          <a data-goto="doctors">Compare doctors by fee and experience</a>.</p>
      </div>`;

    const panel = view.querySelector('#book-panel');
    const select = view.querySelector('#pick-doctor');
    const preview = view.querySelector('#doctor-preview');

    const list = (await Api.listDoctors()).filter(d => d.availability_status === 'Available');

    if (!list.length) {
      panel.innerHTML = Render.empty({
        icon: 'calendar-off',
        title: 'No doctors are accepting bookings',
        message: 'Every doctor is currently marked Busy or On Leave. Please check again later.'
      });
      return;
    }

    select.innerHTML = '<option value="">Select a doctor</option>' +
      list.map(d => `<option value="${d.doctor_id}">${Util.esc(d.name)} — ${Util.esc(d.specialization)}</option>`).join('');

    select.addEventListener('change', () => {
      const d = list.find(x => x.doctor_id === Number(select.value));
      preview.innerHTML = d
        ? `<div class="card card-tight mb-2" style="background:var(--navy-050);border-color:var(--navy-100)">
             ${Render.detailList([
               ['Experience', `${d.experience} years`],
               ['Fee', `<span class="num">${Util.currency(d.consultation_fee)}</span>`],
               ['Consulting hours', d.slots.join(', ')]
             ])}
           </div>`
        : '';
    });

    view.querySelector('#continue-booking').addEventListener('click', () => {
      const v = Form.values(panel);
      if (!Form.validate(panel, v, [Rules.required('doctor_id', 'Doctor')])) return;
      openBookingDialog(v.doctor_id, () => App.go('appointments'));
    });

    Util.onClick(view, '[data-goto]', el => App.go(el.dataset.goto));
  }

  /* ======================================================================
     My appointments
     ====================================================================== */
  async function appointments(view) {
    view.innerHTML = `
      <div class="view-head">
        <h1>My appointments</h1>
        <p>Everything you have booked, grouped by what happens next.</p>
      </div>
      <div class="chips mb-3" id="appt-tabs">
        <button class="chip" data-tab="upcoming" aria-pressed="true">Upcoming</button>
        <button class="chip" data-tab="past" aria-pressed="false">Past</button>
        <button class="chip" data-tab="cancelled" aria-pressed="false">Cancelled</button>
        <button class="chip" data-tab="all" aria-pressed="false">All</button>
      </div>
      <div id="appt-list" aria-live="polite"></div>`;

    const listEl = view.querySelector('#appt-list');
    let tab = 'upcoming';

    async function load() {
      listEl.innerHTML = Render.skeletonRows(3);
      const all = await Api.listAppointments({ patientId: App.session.id });
      const today = Util.todayISO();

      const buckets = {
        upcoming: all.filter(a => a.appointment_date >= today && (a.status === 'Pending' || a.status === 'Confirmed')),
        past: all.filter(a => a.status === 'Completed' || (a.appointment_date < today && a.status !== 'Cancelled')),
        cancelled: all.filter(a => a.status === 'Cancelled'),
        all
      };
      const list = buckets[tab];

      const emptyCopy = {
        upcoming: { title: 'Nothing scheduled', message: 'Book a slot and it will show up here.' },
        past: { title: 'No past visits yet', message: 'Completed appointments are kept here as a record.' },
        cancelled: { title: 'No cancellations', message: 'Appointments you cancel will be listed here.' },
        all: { title: 'No appointments yet', message: 'Your booking history will build up here.' }
      }[tab];

      if (!list.length) {
        listEl.innerHTML = Render.empty({
          icon: 'calendar-off',
          ...emptyCopy,
          action: '<button class="btn btn-primary btn-sm" data-goto="doctors">Find a doctor</button>'
        });
        return;
      }

      listEl.innerHTML = list.map(a => {
        const canCancel = a.status === 'Pending' || a.status === 'Confirmed';
        const actions = `
          <button class="btn btn-secondary btn-sm" data-view="${a.appointment_id}">Details</button>
          ${canCancel ? `<button class="btn btn-danger btn-sm" data-cancel="${a.appointment_id}">Cancel</button>` : ''}`;
        return Render.appointment(a, { perspective: 'patient', actions });
      }).join('');
    }

    Util.onClick(view, '[data-tab]', el => {
      tab = el.dataset.tab;
      view.querySelectorAll('#appt-tabs .chip').forEach(c => c.setAttribute('aria-pressed', String(c === el)));
      load();
    });

    Util.onClick(view, '[data-goto]', el => App.go(el.dataset.goto));

    Util.onClick(view, '[data-view]', async el => {
      const all = await Api.listAppointments({ patientId: App.session.id });
      const a = all.find(x => x.appointment_id === Number(el.dataset.view));
      Modal.open({
        title: 'Appointment details',
        subtitle: `Reference #${a.appointment_id}`,
        body: Render.detailList([
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

    Util.onClick(view, '[data-cancel]', async el => {
      const id = Number(el.dataset.cancel);
      const yes = await Modal.confirm({
        title: 'Cancel this appointment?',
        message: 'The slot goes back into the doctor\'s available times. You can book again later, but this booking cannot be restored.',
        confirmLabel: 'Cancel appointment',
        danger: true
      });
      if (!yes) return;
      await Api.updateAppointmentStatus(id, 'Cancelled');
      Toast.ok('Appointment cancelled');
      load();
    });

    load();
  }

  /* ======================================================================
     Profile
     ====================================================================== */
  async function profile(view) {
    view.innerHTML = Render.skeletonRows(4);
    const p = await Api.getPatient(App.session.id);

    view.innerHTML = `
      <div class="view-head">
        <h1>My profile</h1>
        <p>Keep your contact details current so the clinic can reach you.</p>
      </div>

      <div class="card" style="max-width:620px" id="profile-form">
        <div class="row mb-3">
          <span class="avatar avatar-lg">${Util.esc(Util.initials(`${p.first_name} ${p.last_name}`))}</span>
          <div>
            <h3>${Util.esc(p.first_name)} ${Util.esc(p.last_name)}</h3>
            <div class="small muted">${Util.esc(p.email)}</div>
            <div class="small muted">Patient ID ${p.patient_id} · registered ${Util.esc(Util.formatDateShort(p.registered_on))}</div>
          </div>
        </div>

        <hr class="rule">
        <div class="alert-slot"></div>

        <div class="form-grid">
          <div class="field">
            <label for="pr-first">First name</label>
            <input type="text" id="pr-first" data-field="first_name" value="${Util.esc(p.first_name)}">
            <div class="field-error"></div>
          </div>
          <div class="field">
            <label for="pr-last">Last name</label>
            <input type="text" id="pr-last" data-field="last_name" value="${Util.esc(p.last_name)}">
            <div class="field-error"></div>
          </div>
        </div>

        <div class="field">
          <label for="pr-email">Email address</label>
          <input type="email" id="pr-email" data-field="email" value="${Util.esc(p.email)}">
          <div class="field-error"></div>
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="pr-phone">Phone number</label>
            <input type="tel" id="pr-phone" data-field="phone" value="${Util.esc(p.phone)}">
            <div class="field-error"></div>
          </div>
          <div class="field">
            <label for="pr-dob">Date of birth</label>
            <input type="date" id="pr-dob" data-field="date_of_birth" value="${Util.esc(p.date_of_birth)}">
            <div class="field-error"></div>
          </div>
        </div>

        <div class="field">
          <label for="pr-blood">Blood group</label>
          <select id="pr-blood" data-field="blood_group">
            <option value="">Not specified</option>
            ${['A+','A-','B+','B-','AB+','AB-','O+','O-']
              .map(b => `<option${b === p.blood_group ? ' selected' : ''}>${b}</option>`).join('')}
          </select>
          <div class="hint">Frontend-only field — not yet a column in the patient table.</div>
        </div>

        <div class="field">
          <label for="pr-notes">Medical notes</label>
          <textarea id="pr-notes" data-field="medical_notes" rows="3"
            placeholder="Allergies, long-term conditions, current medication">${Util.esc(p.medical_notes)}</textarea>
          <div class="hint">Frontend-only field — not yet a column in the patient table.</div>
        </div>

        <div class="btn-group mt-2">
          <button class="btn btn-primary" id="save-profile">Save changes</button>
          <button class="btn btn-ghost" id="reset-profile">Discard</button>
        </div>
      </div>`;

    const form = view.querySelector('#profile-form');

    view.querySelector('#save-profile').addEventListener('click', async () => {
      const v = Form.values(form);
      const ok = Form.validate(form, v, [
        Rules.required('first_name', 'First name'),
        Rules.required('last_name', 'Last name'),
        Rules.email('email'),
        Rules.phone('phone')
      ]);
      if (!ok) return;

      await Api.updatePatient(p.patient_id, v);
      App.session.name = `${v.first_name} ${v.last_name}`;
      App.refreshIdentity();
      Form.formSuccess(form, 'Profile saved.');
      Toast.ok('Profile saved');
    });

    view.querySelector('#reset-profile').addEventListener('click', () => App.go('profile'));
  }

  /* Small debounce so typing in search doesn't fire a request per keystroke. */
  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  return { dashboard, doctors, book, appointments, profile, openBookingDialog };
})();
