# MediBook — Doctor Appointment Booking System

A full-stack, role-based appointment booking system with three dedicated panels: **patient**, **doctor**, and **administrator**.

This system is fully integrated with a **Node.js/Express REST API** and a **MySQL relational database**. All user accounts, appointments, doctor availability, and profiles persist in real time.

---

## Running the Application

### 1. Start the Backend Server
```bash
cd backend
npm start
```
The server connects to MySQL (`appointment_db`) and listens on `http://localhost:5000`.

### 2. Launch the Frontend
- **Option A — Unified Express Server (Recommended):** Open `http://localhost:5000` in your web browser.
- **Option B — VS Code Live Server:** Open `frontend/index.html` with Live Server at `http://127.0.0.1:5500`.
- **Option C — Direct:** Double-click `frontend/index.html`.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Patient | `rahul@example.com` | `demo123` |
| Doctor | `ravi.kumar@medibook.test` | `demo123` |
| Admin | `admin@medibook.test` | `demo123` |

The login page has a one-click switcher that fills these in.

---

## Folder structure

```
medibook/
├── index.html              Public pages + the dashboard shell
├── css/
│   ├── base.css            Design tokens, reset, typography, utilities
│   ├── components.css      Buttons, cards, forms, tables, badges, modal, toast
│   └── layout.css          Navbar, landing, sidebar shell, responsive rules
├── js/
│   ├── data.js             ALL mock data (patients, doctors, appointments)
│   ├── ui.js               Util / Icon / Toast / Modal / Render / Form helpers
│   ├── api.js              Mock API — the only file that touches data
│   ├── views.patient.js    Patient screens
│   ├── views.doctor.js     Doctor screens
│   ├── views.admin.js      Admin screens
│   └── app.js              Session, route table, role-based navigation
└── README.md
```

Load order matters and is set in `index.html`: `data → ui → api → views → app`.

### Why plain HTML/CSS/JS and not React

React would need Node, npm, a bundler and a build step before your project runs at all.
The entire data layer here is three arrays. The things React would have given you —
reusable components and a single state source — are covered by `Render.*` in `ui.js`
and by `Api` in `api.js`. If you later add a real backend and the app grows past
roughly a dozen screens, React becomes worth the setup cost; it is not worth it now.

---

## Architecture

### One route table drives all navigation

`ROUTES` in `js/app.js` maps each role to the screens it owns:

```javascript
const ROUTES = {
  patient: [ { key:'dashboard', label:'Dashboard', icon:'dashboard', render: PatientView.dashboard }, … ],
  doctor:  [ … ],
  admin:   [ … ]
};
```

The sidebar, the topbar title and the rendered screen all come from the same entry.
Adding a screen means adding one object to one array.

Role isolation falls out of this: `App.go('patients')` while logged in as a patient
finds no matching route and falls back to the patient dashboard. A role's screens are
never even drawn into the DOM for another role.

### All data access goes through `Api`

No view reads `DOCTORS` or `APPOINTMENTS` directly. Every screen calls something like:

```javascript
const list = await Api.listAppointments({ patientId: App.session.id });
```

`Api` returns Promises with a small artificial delay, exactly like `fetch` would.
That is what makes the loading skeletons real and what makes backend integration a
one-file change.

### Data models

Field names match the planned MySQL schema.

```javascript
// patient
{ patient_id: 1, first_name: "Rahul", last_name: "Sharma",
  email: "rahul@example.com", phone: "+91 98765 43210",
  date_of_birth: "2005-06-15" }

// doctor
{ doctor_id: 101, name: "Dr. Ravi Kumar", specialization: "Cardiologist",
  experience: 10, consultation_fee: 800, availability_status: "Available" }

// appointment
{ appointment_id: 1, patient_id: 1, doctor_id: 101,
  appointment_date: "2026-10-10", appointment_time: "10:00 AM",
  reason: "General consultation", status: "Pending" }
```

`status` is one of `Pending`, `Confirmed`, `Completed`, `Cancelled`.
`availability_status` is one of `Available`, `Busy`, `On Leave`.

---

## Mock-only fields

These are **not** in the ER diagram. They exist so the frontend has something to show.
Either add the column or delete the field before integration. Each one is tagged
`// MOCK-ONLY` in `js/data.js`.

| Table | Field | Note |
|---|---|---|
| patient | `blood_group` | Shown on the profile screen |
| patient | `medical_notes` | Shown to the doctor in the patient dialog |
| patient | `registered_on` | Would map to `created_at` |
| doctor | `email`, `phone` | Email is needed for doctor login |
| doctor | `qualification`, `about` | Shown on the doctor detail dialog |
| doctor | `slots` | Belongs in a separate `doctor_schedule` table |
| doctor | `is_active` | Soft-delete flag so admin deactivation keeps foreign keys valid |
| appointment | `booked_on` | Would map to `created_at` |
| — | `ACTIVITY` array | Sample admin activity feed, entirely fabricated |

---

## What is real and what is faked

**Working frontend behaviour**
- Search, filter and sort doctors
- Booking with double-booking prevention and past-date rejection
- Only free slots are offered for the chosen date
- Full status lifecycle: Pending → Confirmed → Completed, or → Cancelled
- Patient cancellation, doctor accept/decline/complete, admin status correction
- Admin doctor CRUD with soft delete, patient search, appointment filters
- Per-field validation, confirmation dialogs, empty states, loading skeletons

**Faked**
- **Login.** Passwords are compared in plain JavaScript that anyone can read in
  DevTools. This is a role switcher, not authentication.
- **Persistence.** Everything resets on page refresh.
- **Authorisation.** Role isolation here is a UI convenience. A real system enforces
  it on the server — hiding a button does not protect an endpoint.
- **The activity feed** on the admin dashboard.

---

## Backend integration

When the Express + MySQL backend is ready, edit **only `js/api.js`**. Each function
already has its intended route in a comment above it.

| `Api` function | Route |
|---|---|
| `login` | `POST /api/auth/login` |
| `registerPatient` | `POST /api/patients` |
| `listDoctors` | `GET /api/doctors?search=&specialization=` |
| `getDoctor` | `GET /api/doctors/:id` |
| `createDoctor` | `POST /api/admin/doctors` |
| `updateDoctor` | `PATCH /api/admin/doctors/:id` |
| `setDoctorActive` | `PATCH /api/admin/doctors/:id` |
| `listPatients` | `GET /api/admin/patients?search=` |
| `getPatient` | `GET /api/patients/:id` |
| `updatePatient` | `PUT /api/patients/:id` |
| `listAppointments` | `GET /api/appointments?patient_id=&doctor_id=&status=&date=` |
| `createAppointment` | `POST /api/appointments` |
| `updateAppointmentStatus` | `PATCH /api/appointments/:id/status` |
| `getAvailableSlots` | `GET /api/doctors/:id/slots?date=` |
| `getAdminStats` | `GET /api/admin/stats` |

A converted function looks like this:

```javascript
// Before
function listDoctors({ search = '', specialization = '' } = {}) {
  const list = doctors.filter(/* … */);
  return respond(list);
}

// After
async function listDoctors({ search = '', specialization = '' } = {}) {
  const params = new URLSearchParams({ search, specialization });
  const res = await fetch(`/api/doctors?${params}`);
  if (!res.ok) throw new Error('Could not load doctors.');
  return res.json();
}
```

No view file changes, because every view already awaits the result and already handles
a thrown error.

### Things the server must own

- **Password hashing** (bcrypt) and session tokens. Never send or compare plaintext.
- **Role checks on every route.** The frontend hides admin screens; the server must refuse them.
- **A `UNIQUE` index on `(doctor_id, appointment_date, appointment_time)`.** The
  browser's double-booking check cannot stop two patients submitting at the same moment.
- **Deciding the appointment's initial status.** The frontend sends the booking; the
  server sets `Pending`.
- **`doctor_schedule`**, if you want per-weekday consulting hours rather than one shared slot list.

### Assumptions made

1. A new booking starts as `Pending` and needs the doctor's confirmation. Change
   `createAppointment` if your ER diagram auto-confirms instead.
2. Deactivating a doctor is a soft delete (`is_active = false`), not a `DELETE`,
   so historical appointments keep a valid foreign key.
3. Doctors log in with their email address, which means the `doctor` table needs an
   email column (or a shared `users` table with a role column — the cleaner option).
4. Consultation slots are a fixed list shared by all doctors, each doctor choosing a
   subset. Real scheduling would be per weekday.
5. Times are stored as display strings (`"10:00 AM"`). MySQL `TIME` would store
   `10:00:00`; convert at the API boundary.

---

## Changes from the original prototype

| Change | Reason |
|---|---|
| Added `<!DOCTYPE html>`, `<head>`, stylesheet links | The original was a fragment and did not run standalone |
| Defined all CSS variables in `base.css` | The original used `--color-background-primary` and similar variables that were never declared, so colours and radii silently fell back |
| Replaced the Tabler icon font with inline SVG | The original's `<i class="ti ti-…">` icons needed a stylesheet that was never linked — every icon rendered as an empty box |
| Route table instead of an if/else chain | `showPage()` had eight branches just to highlight a nav link |
| `consultation_fee` is a number, not `"₹800"` | Strings cannot be sorted, filtered or summed |
| Four appointment statuses instead of two | The doctor workflow needs Pending and Completed |
| Field names match the ER model | `docId` → `doctor_id`, `spec` → `specialization`, `exp` → `experience`, `avail` → `availability_status` |
| All user input escaped before `innerHTML` | The original interpolated raw input into template strings |
| A fresh view node on each navigation | Delegated listeners were otherwise accumulating across screens, so a click on one screen could fire a handler belonging to a screen you had left |

Nothing from the original was removed. Doctor search, specialization filters, the booking
modal, cancellation, the profile form with blood group and medical notes, toasts and
inline validation are all still here, restructured.

---

## Manual test checklist

Verified in Chromium at 1280px and 390px, with no console errors.

**Patient** — register with mismatched passwords (rejected) · log in · dashboard counts ·
search and sort doctors · book with empty fields (rejected) · book a real slot · appears as
Pending · cancel with confirmation · moves to the Cancelled tab · save profile with a bad
email (rejected) · save a valid profile.

**Doctor** — log in · pending count badge in the sidebar · accept a request · mark a
confirmed visit completed · decline and then back out of the confirmation · open a patient
detail dialog · toggle a consulting slot and save · change availability to Busy · update the
consultation fee.

**Admin** — log in · dashboard charts and activity · add a doctor with empty fields
(rejected) · add a valid doctor · edit a fee · deactivate with confirmation · reactivate ·
search patients · open a patient's history · filter appointments by doctor, status and date ·
change a status to the same value (rejected) · change it to a new value · empty state on a
search with no matches.

**Responsive** — sidebar collapses to a drawer below 780px and closes on navigation ·
public nav collapses to a dropdown · tables scroll horizontally rather than breaking
the layout.
