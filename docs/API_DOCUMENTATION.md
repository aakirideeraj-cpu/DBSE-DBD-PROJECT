# MediBook API Documentation

This document describes all RESTful API endpoints provided by the MediBook backend server (`http://localhost:5000/api`).

---

## 1. Overview & Conventions

- **Base URL:** `http://localhost:5000/api`
- **Request / Response Content-Type:** `application/json`
- **Standard Success Response Format:**
  ```json
  {
    "success": true,
    "<dataKey>": ...
  }
  ```
- **Standard Error Response Format:**
  ```json
  {
    "success": false,
    "message": "Human-readable error explanation"
  }
  ```

---

## 2. Authentication

### `POST /api/auth/login`
Authenticates a user across Patient, Doctor, and Administrator roles against the MySQL database.

- **Request Body:**
  ```json
  {
    "email": "rahul@example.com",
    "password": "demo123"
  }
  ```
- **Responses:**
  - `200 OK`:
    ```json
    {
      "success": true,
      "session": {
        "role": "patient",
        "id": 6,
        "name": "Rahul Sharma",
        "email": "rahul@example.com"
      }
    }
    ```
  - `401 Unauthorized`:
    ```json
    {
      "success": false,
      "message": "That email and password combination does not match any registered account."
    }
    ```

---

## 3. Patient Endpoints

### `POST /api/patients`
Registers a new patient account in the database and returns an active session.

- **Request Body:**
  ```json
  {
    "first_name": "Suresh",
    "last_name": "Raina",
    "email": "suresh@example.com",
    "phone": "+91 98765 12345",
    "date_of_birth": "1995-04-12",
    "password": "mypassword123"
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "success": true,
    "patient": {
      "patient_id": 7,
      "first_name": "Suresh",
      "last_name": "Raina",
      "email": "suresh@example.com",
      "phone": "+91 98765 12345"
    },
    "session": {
      "role": "patient",
      "id": 7,
      "name": "Suresh Raina",
      "email": "suresh@example.com"
    }
  }
  ```

### `GET /api/patients`
Lists and searches all patients. Used by clinic administrators.

- **Query Parameters:**
  - `search` *(optional)*: Search term matching patient name, email, or phone.
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "patients": [
      {
        "patient_id": 1,
        "first_name": "Deeraj",
        "last_name": "Kumar",
        "patient_name": "Deeraj Kumar",
        "email": "deeraj@gmail.com",
        "phone": "+91 98765 43211",
        "date_of_birth": "2007-02-14",
        "blood_group": "B+",
        "medical_notes": "No known allergies.",
        "registered_on": "2026-01-15"
      }
    ]
  }
  ```

### `GET /api/patients/:id`
Retrieves full profile details for a specific patient.

- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "patient": {
      "patient_id": 1,
      "first_name": "Deeraj",
      "last_name": "Kumar",
      "email": "deeraj@gmail.com",
      "phone": "+91 98765 43211",
      "date_of_birth": "2007-02-14",
      "blood_group": "B+",
      "medical_notes": "No known allergies.",
      "registered_on": "2026-01-15"
    }
  }
  ```

### `PUT /api/patients/:id`
Updates patient profile details.

- **Request Body:**
  ```json
  {
    "first_name": "Deeraj",
    "last_name": "Kumar",
    "email": "deeraj@gmail.com",
    "phone": "+91 98765 43211",
    "date_of_birth": "2007-02-14",
    "blood_group": "O+",
    "medical_notes": "Mild seasonal allergies."
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "patient": { ... }
  }
  ```

### `GET /api/patients/:id/stats`
Retrieves appointment statistics for a given patient.

- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "stats": {
      "total": 3,
      "pending": 1,
      "confirmed": 1,
      "completed": 1,
      "cancelled": 0
    }
  }
  ```

---

## 4. Doctor Endpoints

### `GET /api/doctors`
Returns the list of medical practitioners with optional filtering.

- **Query Parameters:**
  - `search` *(optional)*: Search string matching doctor name or specialization.
  - `specialization` *(optional)*: Exact specialization filter.
  - `includeInactive` *(optional, default: false)*: Whether to include deactivated doctors (for admin panel).
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "doctors": [
      {
        "doctor_id": 101,
        "name": "Dr. Ravi Kumar",
        "doctor_name": "Dr. Ravi Kumar",
        "specialization": "Cardiologist",
        "consultation_fee": 800,
        "experience": 10,
        "availability_status": "Available",
        "email": "ravi.kumar@medibook.test",
        "phone": "+91 98800 10101",
        "qualification": "MBBS, MD (Cardiology)",
        "about": "Treats hypertension, arrhythmia and post-operative cardiac care.",
        "slots": ["09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"],
        "is_active": true
      }
    ]
  }
  ```

### `GET /api/doctors/:id`
Retrieves details for a single doctor.

### `POST /api/admin/doctors`
Adds a new doctor to the clinic directory.

- **Request Body:**
  ```json
  {
    "name": "Dr. Sunita Sen",
    "specialization": "Neurologist",
    "experience": 11,
    "consultation_fee": 950,
    "availability_status": "Available",
    "email": "sunita.sen@medibook.test",
    "phone": "+91 98800 10909",
    "qualification": "MBBS, DM (Neurology)",
    "about": "Specialist in neuro-degenerative disorders."
  }
  ```
- **Response `201 Created`:** Returns created doctor object.

### `PATCH /api/admin/doctors/:id`
Partially updates a doctor's record (e.g., fee, consulting slots, availability status, deactivation).

- **Request Body Example:**
  ```json
  {
    "consultation_fee": 850,
    "availability_status": "Busy"
  }
  ```
- **Response `200 OK`:** Returns updated doctor record.

### `GET /api/doctors/:id/slots?date=YYYY-MM-DD`
Calculates slot availability for a doctor on a specific date by checking booked appointments.

- **Query Parameters:**
  - `date`: Appointment date (`YYYY-MM-DD`).
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "slots": [
      { "time": "09:00 AM", "taken": false },
      { "time": "10:00 AM", "taken": true },
      { "time": "11:00 AM", "taken": false }
    ]
  }
  ```

### `GET /api/doctors/:id/stats`
Retrieves appointment statistics for a specific doctor.

---

## 5. Appointment Endpoints

### `GET /api/appointments`
Returns appointments joined with patient and doctor details, filtered by criteria.

- **Query Parameters:**
  - `patient_id` *(optional)*: Filter by patient ID.
  - `doctor_id` *(optional)*: Filter by doctor ID.
  - `status` *(optional)*: `Pending`, `Confirmed`, `Completed`, `Cancelled`.
  - `date` *(optional)*: Specific date filter (`YYYY-MM-DD`).
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "appointments": [
      {
        "appointment_id": 1,
        "patient_id": 1,
        "doctor_id": 101,
        "appointment_date": "2026-10-10",
        "appointment_time": "10:00 AM",
        "reason": "Chest tightness after exercise",
        "status": "Confirmed",
        "booked_on": "2026-09-18",
        "patient_name": "Rahul Sharma",
        "patient_phone": "+91 98765 43210",
        "doctor_name": "Dr. Ravi Kumar",
        "specialization": "Cardiologist",
        "consultation_fee": 800
      }
    ]
  }
  ```

### `POST /api/appointments`
Creates a new appointment booking. Automatically checks against double booking conflicts.

- **Request Body:**
  ```json
  {
    "patient_id": 1,
    "doctor_id": 101,
    "appointment_date": "2026-11-15",
    "appointment_time": "11:00 AM",
    "reason": "Routine checkup"
  }
  ```
- **Responses:**
  - `201 Created`: Returns newly created appointment object with `status: "Pending"`.
  - `409 Conflict`: Returned if slot is already occupied by a Pending or Confirmed visit.

### `PATCH /api/appointments/:id/status`
Updates an appointment's status (`Pending`, `Confirmed`, `Completed`, `Cancelled`).

- **Request Body:**
  ```json
  {
    "status": "Confirmed"
  }
  ```
- **Response `200 OK`:** Returns updated appointment record.

---

## 6. Admin Statistics

### `GET /api/admin/stats`
Returns system-wide operational metrics, breakdown charts, and live activity.

- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "stats": {
      "patients": 6,
      "doctors": 8,
      "appointments": {
        "total": 11,
        "pending": 4,
        "confirmed": 5,
        "completed": 2,
        "cancelled": 0
      },
      "bySpecialization": [
        { "label": "Cardiologist", "count": 4 },
        { "label": "Dermatologist", "count": 3 }
      ],
      "activity": [
        {
          "icon": "calendar-plus",
          "text": "Rahul Sharma booked with Dr. Ravi Kumar",
          "when": "2026-09-21"
        }
      ]
    }
  }
  ```
