# Academic Project Submission Manifest & Grading Guide

**Course:** Database Systems Engineering & Database Design (DBSE-DBD)  
**Project Title:** MediBook — Multi-Role Doctor Appointment Booking System  
**Tech Stack:** Node.js, Express 5, MySQL 8.0, HTML5/CSS3/JavaScript (ES6+)  

---

## 1. Submission Package Contents

```
DBSE-DBD-PROJECT/
├── SUBMISSION_CHECKLIST.md      # This submission manifest & evaluation guide
├── README.md                    # Project overview & quick start
├── backend/                     # Business Logic Tier (Express REST API)
│   ├── .env                     # Local MySQL credentials
│   ├── .env.example             # Configuration template
│   ├── db.js                    # MySQL2 connection pooling configuration
│   ├── migrate.js               # Database schema migration & procedure loader
│   ├── package.json             # NPM dependencies and scripts
│   ├── server.js                # Core REST API server with 15+ endpoints
│   └── test_api.js              # Automated end-to-end endpoint verification
├── database/                    # Database Tier (DDL & DML)
│   ├── schema.sql               # Base tables (3NF), check constraints, views & procedures
│   └── seeds.sql                # Comprehensive sample records (doctors, patients, appts)
├── docs/                        # Academic Reports & Documentation
│   ├── PROJECT_REPORT.md        # Full project report (ER diagram, 3NF proofs, RBAC)
│   └── API_DOCUMENTATION.md     # Complete REST API specifications
└── frontend/                    # Presentation Tier (Single-Page App)
    ├── index.html               # Semantic HTML shell
    ├── README.md                # UI architecture & panel breakdown
    └── src/
        ├── css/                 # base.css, layout.css, components.css
        └── js/                  # api.js, app.js, data.js, ui.js, views.*.js
```

---

## 2. Database Design & Engineering Highlights

1. **Relational Normalization (3NF):**
   - **1NF:** Atomic attributes, unique primary keys (`admin_id`, `doctor_id`, `patient_id`, `appointment_id`).
   - **2NF:** No partial dependencies; non-key attributes depend entirely on the composite / primary keys.
   - **3NF:** No transitive dependencies. Doctor, patient, and appointment entities are decoupled into isolated relations with foreign key relationships.

2. **Integrity & Double-Booking Prevention:**
   - Enforced by composite unique constraint:
     `UNIQUE KEY uq_doc_slot (doctor_id, appointment_date, appointment_time)`
   - Dual-layer protection: Handled gracefully at the API layer (HTTP 409 Conflict) and strictly prevented at the MySQL InnoDB engine layer.

3. **Advanced Database Objects:**
   - **Relational View:** `appointment_details` — pre-joins appointment records with patient contact information and doctor clinical metadata.
   - **Stored Procedures:**
     - `GetDoctorsBySpecialization(IN spec VARCHAR(100))`
     - `GetPatientAppointments(IN p_id INT)`
     - `GetDoctorAppointments(IN d_id INT)`

---

## 3. Evaluation Quick Start (3 Steps)

### Step 1: Database Setup
Make sure MySQL is running on `localhost:3306`, then execute:
```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seeds.sql
```
*(Or run `npm run migrate` inside `backend/` to automatically prepare tables and procedures).*

### Step 2: Start Backend Server
```bash
cd backend
npm install
npm start
```
The server will start at `http://localhost:5000`.

### Step 3: Run Automated Test Verification
In a separate terminal:
```bash
cd backend
npm test
```
**Expected Result:** 100% tests pass (Health check, Login for all 3 roles, Doctor search, Slot calculation, Patient management, Double-booking conflict 409, and Admin analytics).

### Step 4: Access Application
Open `http://localhost:5000` in any modern web browser.

---

## 4. Evaluator Demo Accounts

| Role | Email | Password | Pre-loaded Data |
|---|---|---|---|
| **Patient** | `rahul@example.com` | `demo123` | Active bookings, medical history, notes |
| **Doctor** | `ravi.kumar@medibook.test` | `demo123` | Cardiologist, daily schedule & pending requests |
| **Admin** | `admin@medibook.test` | `demo123` | Clinic directory, patient register & analytics |
