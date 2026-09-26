# MediBook — Doctor Appointment Booking System

[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-5.x-blue.svg)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-orange.svg)](https://www.mysql.com/)
[![License](https://img.shields.io/badge/License-ISC-lightgrey.svg)](LICENSE)

An academic **Database Systems Engineering / Database Design (DBSE-DBD)** project delivering a full-stack, role-based Doctor Appointment Booking System with integrated **Patient**, **Doctor**, and **Administrator** panels.

---

## 🌟 Highlights

- **3 Dedicated Panels:**
  - **Patient Panel:** Discover specialists, filter by fee/experience, book conflict-free time slots, cancel requests, and manage personal medical notes.
  - **Doctor Panel:** Review daily schedules, accept or decline booking requests, mark consultations completed, customize consulting hours, and toggle availability.
  - **Admin Panel:** Maintain the doctor directory (with soft-deactivation), inspect patient records, audit appointments, correct statuses, and review system-wide analytics.
- **Robust Database Engineering:**
  - 3NF relational normalization across MySQL base tables.
  - Composite unique constraint `(doctor_id, appointment_date, appointment_time)` guaranteeing double-booking prevention.
  - Relational views (`appointment_details`) and stored procedures (`GetDoctorsBySpecialization`, `GetPatientAppointments`, `GetDoctorAppointments`).
- **Clean RESTful API:** Express.js async backend providing 15+ REST endpoints with CORS, JSON body validation, connection pooling, and error handling.
- **Modern Responsive UI:** Pure HTML5/CSS3/JavaScript (no bulky build steps required), featuring real-time feedback, toasts, confirmation dialogs, and SVG icons.

---

## 📁 Project Structure

```
DBSE-DBD-PROJECT/
├── backend/                  # Node.js + Express REST API Server
│   ├── .env                  # Database connection credentials
│   ├── db.js                 # MySQL2 promise connection pool
│   ├── migrate.js            # Database migration and seed runner
│   ├── package.json          # Dependencies and npm scripts
│   ├── server.js             # Main Express server and REST routes
│   └── test_api.js           # Automated end-to-end API test suite
│
├── database/                 # SQL DDL & Seed Files
│   ├── schema.sql            # Full MySQL schema DDL (tables, views, procedures)
│   └── seeds.sql             # Comprehensive sample seed data
│
├── docs/                     # Project Documentation
│   ├── API_DOCUMENTATION.md  # Detailed REST API endpoint specification
│   └── PROJECT_REPORT.md     # Academic project report (ER diagram, 3NF, architecture)
│
├── frontend/                 # Client Presentation Tier
│   ├── index.html            # Single-page application shell
│   ├── README.md             # Frontend specific documentation
│   └── src/
│       ├── css/              # base.css, layout.css, components.css
│       └── js/
│           ├── api.js        # Central API client (makes live fetch calls)
│           ├── app.js        # Route table & session manager
│           ├── data.js       # App constants & demo switchers
│           ├── ui.js         # Dialogs, modals, toasts, SVG icons, form validation
│           ├── views.patient.js # Patient dashboard, search, booking & profile
│           ├── views.doctor.js  # Doctor agenda, requests & schedule manager
│           └── views.admin.js   # Admin directory, audit & system stats
│
└── screenshots/              # Application preview screenshots
```

---

## 💻 How to Run Locally

> 📖 **Setting up on a new teammate's PC?**
> Please follow the complete, step-by-step Windows setup guide in **[docs/TEAM_SETUP.md](docs/TEAM_SETUP.md)** covering Node.js, MySQL Workbench, environment setup, and troubleshooting.

### Quick Start (Summary)

1. **Database Setup (MySQL):**
   Execute the single-step installation script in MySQL Workbench or via CLI:
   ```bash
   mysql -u root -p < database/setup-database.sql
   ```
2. **Environment Configuration:**
   Copy the example environment file and set your MySQL password:
   ```bash
   cd backend
   cp .env.example .env
   ```
   Edit `backend/.env` and update `DB_PASSWORD=YOUR_MYSQL_PASSWORD`.

3. **Install Dependencies & Start Backend:**
   ```bash
   npm install
   node server.js
   ```
   The backend connects to MySQL and starts on `http://localhost:5000`.

4. **Open Application & Run Tests:**
   - **Frontend:** Open `http://localhost:5000` in your web browser.
   - **Verification:** Run `npm test` in the `backend` directory to execute automated endpoint tests.

---

## 🔑 Demo Accounts

The login screen includes quick one-click buttons to load credentials for each role:

| Role | Email | Password | Details |
|---|---|---|---|
| **Patient** | `rahul@example.com` | `demo123` | Active patient with bookings & medical notes |
| **Doctor** | `ravi.kumar@medibook.test` | `demo123` | Cardiologist with active schedule & requests |
| **Admin** | `admin@medibook.test` | `demo123` | Clinic administrator with full directory access |

*Note: Any newly registered patient account immediately persists to MySQL and can log in.*

---

## 📚 Academic Documentation

- 📄 **[Comprehensive Academic Project Report](docs/PROJECT_REPORT.md)** — Detailed ER diagram (Mermaid), relational schema, 3NF normalization proofs, stored procedure documentation, and RBAC matrix.
- 🔌 **[REST API Documentation](docs/API_DOCUMENTATION.md)** — Complete request and response payloads, status codes, and query parameter specifications.
