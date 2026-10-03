/**
 * MediBook — Appointment Service
 * Port: 5002
 *
 * Handles all business logic for:
 *  - Doctors (list, get, create, update)
 *  - Patients (list, get, update, stats)
 *  - Appointments (list, book, update status)
 *  - Admin statistics
 *
 * JWT Protection:
 *  - Public: GET /doctors, GET /doctors/:id, GET /doctors/:id/slots
 *  - Patient only: POST /appointments, GET /appointments (own)
 *  - Doctor only:  PATCH /appointments/:id/status (own), GET /doctors/:id/stats
 *  - Admin only:   POST /admin/doctors, PATCH /admin/doctors/:id, GET /admin/stats, GET /patients
 *  - Patient+Admin: GET /patients/:id
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { requireAuth, requireRole } = require("./middleware/auth");

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// DATABASE POOL
// ==========================================
const pool = mysql.createPool({
  host:     process.env.DB_HOST || "localhost",
  user:     process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "appointment_db",
  port:     Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
});

// ==========================================
// HELPER FUNCTIONS (identical to main server.js)
// ==========================================
const DEFAULT_SLOTS = [
  "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"
];

function formatTimeToDisplay(timeStr) {
  if (!timeStr) return "";
  const trimmed = String(timeStr).trim();
  if (/(AM|PM)$/i.test(trimmed)) return trimmed;
  const parts = trimmed.split(":");
  let h = parseInt(parts[0], 10);
  const m = parts[1] || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${String(h).padStart(2, "0")}:${m} ${ampm}`;
}

function formatTimeToDB(timeStr) {
  if (!timeStr) return "09:00:00";
  const trimmed = String(timeStr).trim();
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(trimmed);
  if (!match) return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = match[3] ? match[3].toUpperCase() : null;
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m}:00`;
}

function formatDoctor(d) {
  let slots = DEFAULT_SLOTS;
  if (d.slots) {
    try {
      slots = typeof d.slots === "string" ? JSON.parse(d.slots) : d.slots;
      if (!Array.isArray(slots) || slots.length === 0) slots = DEFAULT_SLOTS;
    } catch { slots = DEFAULT_SLOTS; }
  }
  return {
    doctor_id: Number(d.doctor_id),
    name: d.doctor_name,
    doctor_name: d.doctor_name,
    specialization: d.specialization || "General Physician",
    consultation_fee: Number(d.consultation_fee || 0),
    experience: Number(d.experience || 0),
    availability_status: d.availability_status || "Available",
    email: d.email || "",
    phone: d.phone || "",
    qualification: d.qualification || "MBBS, MD",
    about: d.about || "",
    slots,
    is_active: Boolean(d.is_active === 1 || d.is_active === true)
  };
}

function formatPatient(p) {
  const nameParts = (p.patient_name || "").trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName  = nameParts.slice(1).join(" ") || "";
  let dob = p.date_of_birth || "";
  if (dob && typeof dob === "object" && dob.toISOString) dob = dob.toISOString().split("T")[0];
  let regOn = p.registered_on || "";
  if (regOn && typeof regOn === "object" && regOn.toISOString) regOn = regOn.toISOString().split("T")[0];
  return {
    patient_id: Number(p.patient_id),
    first_name: firstName,
    last_name: lastName,
    patient_name: p.patient_name,
    email: p.email || "",
    phone: p.phone || "",
    date_of_birth: dob,
    blood_group: p.blood_group || "O+",
    medical_notes: p.medical_notes || "",
    age: p.age ?? null,
    gender: p.gender || "",
    registered_on: regOn || new Date().toISOString().split("T")[0]
  };
}

function formatAppointment(a) {
  let appDate = a.appointment_date || "";
  if (appDate && typeof appDate === "object" && appDate.toISOString) appDate = appDate.toISOString().split("T")[0];
  let bookedOn = a.booked_on || "";
  if (bookedOn && typeof bookedOn === "object" && bookedOn.toISOString) bookedOn = bookedOn.toISOString().split("T")[0];
  return {
    appointment_id:   Number(a.appointment_id),
    patient_id:       Number(a.patient_id),
    doctor_id:        Number(a.doctor_id),
    appointment_date: String(appDate).substring(0, 10),
    appointment_time: formatTimeToDisplay(a.appointment_time),
    reason:           a.reason || "General consultation",
    status:           a.status || "Pending",
    booked_on:        bookedOn ? String(bookedOn).substring(0, 10) : new Date().toISOString().split("T")[0],
    patient_name:     a.patient_name || "Unknown patient",
    patient_phone:    a.patient_phone || "",
    doctor_name:      a.doctor_name || "Unknown doctor",
    specialization:   a.specialization || "—",
    consultation_fee: Number(a.consultation_fee || 0)
  };
}

// ==========================================
// HEALTH CHECK
// ==========================================
app.get("/health", (req, res) => {
  res.json({
    service: "Appointment Service",
    status: "running",
    port: process.env.PORT || 5002,
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// DOCTORS — PUBLIC (no auth required)
// ==========================================

// GET /doctors
app.get("/doctors", async (req, res) => {
  try {
    const { search = "", specialization = "", includeInactive = "false" } = req.query;
    let query = "SELECT * FROM doctors WHERE 1=1";
    const params = [];
    if (includeInactive !== "true") { query += " AND is_active = 1"; }
    if (search && search.trim()) {
      query += " AND (doctor_name LIKE ? OR specialization LIKE ?)";
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }
    if (specialization && specialization.trim()) {
      query += " AND specialization = ?";
      params.push(specialization.trim());
    }
    query += " ORDER BY doctor_id ASC";
    const [rows] = await pool.query(query, params);
    res.json({ success: true, doctors: rows.map(formatDoctor) });
  } catch (err) {
    console.error("List doctors error:", err);
    res.status(500).json({ success: false, message: "Failed to load doctors" });
  }
});

// GET /doctors/:id
app.get("/doctors/:id", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM doctors WHERE doctor_id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Doctor not found." });
    res.json({ success: true, doctor: formatDoctor(rows[0]) });
  } catch (err) {
    console.error("Get doctor error:", err);
    res.status(500).json({ success: false, message: "Failed to load doctor" });
  }
});

// GET /doctors/:id/slots?date=
app.get("/doctors/:id/slots", async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;
    if (!date) return res.status(400).json({ success: false, message: "Date query parameter is required." });

    const [doctorRows] = await pool.query("SELECT * FROM doctors WHERE doctor_id = ?", [id]);
    if (doctorRows.length === 0) return res.status(404).json({ success: false, message: "Doctor not found." });

    const doc = formatDoctor(doctorRows[0]);
    const doctorSlots = doc.slots || DEFAULT_SLOTS;

    const [appointments] = await pool.query(`
      SELECT appointment_time FROM appointments
      WHERE doctor_id = ? AND appointment_date = ? AND status IN ('Pending', 'Confirmed')
    `, [id, date]);

    const takenTimes = appointments.map(a => formatTimeToDisplay(a.appointment_time));
    const resultSlots = doctorSlots.map(slot => ({ time: slot, taken: takenTimes.includes(slot) }));
    res.json({ success: true, slots: resultSlots });
  } catch (err) {
    console.error("Slots error:", err);
    res.status(500).json({ success: false, message: "Failed to load slots: " + err.message });
  }
});

// GET /doctors/:id/stats — doctor or admin
app.get("/doctors/:id/stats", requireAuth, requireRole("doctor", "admin"), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT status, COUNT(*) as count FROM appointments WHERE doctor_id = ? GROUP BY status
    `, [req.params.id]);
    const stats = { total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
    rows.forEach(r => {
      const st = (r.status || "").toLowerCase();
      const cnt = Number(r.count);
      stats.total += cnt;
      if (st === "pending") stats.pending += cnt;
      else if (st === "confirmed") stats.confirmed += cnt;
      else if (st === "completed") stats.completed += cnt;
      else if (st === "cancelled") stats.cancelled += cnt;
    });
    res.json({ success: true, stats });
  } catch (err) {
    console.error("Doctor stats error:", err);
    res.status(500).json({ success: false, message: "Failed to load doctor statistics" });
  }
});

// ==========================================
// ADMIN — DOCTOR MANAGEMENT
// ==========================================

// POST /admin/doctors — admin only
app.post("/admin/doctors", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const {
      name, specialization, experience = 0, consultation_fee = 500,
      availability_status = "Available", email = "", phone = "",
      qualification = "MBBS, MD", about = ""
    } = req.body;

    if (!name || !specialization) {
      return res.status(400).json({ success: false, message: "Doctor name and specialization are required." });
    }

    const [result] = await pool.query(`
      INSERT INTO doctors (doctor_name, specialization, experience, consultation_fee, availability_status, email, phone, qualification, about, is_active, slots, password)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'demo123')
    `, [
      name.trim(), specialization.trim(), Number(experience), Number(consultation_fee),
      availability_status, email ? email.trim().toLowerCase() : null,
      phone || "", qualification || "", about || "", JSON.stringify(DEFAULT_SLOTS)
    ]);

    const [rows] = await pool.query("SELECT * FROM doctors WHERE doctor_id = ?", [result.insertId]);
    res.status(201).json({ success: true, doctor: formatDoctor(rows[0]) });
  } catch (err) {
    console.error("Create doctor error:", err);
    res.status(500).json({ success: false, message: "Failed to create doctor: " + err.message });
  }
});

// PATCH /admin/doctors/:id — admin only
app.patch("/admin/doctors/:id", requireAuth, requireRole("admin", "doctor"), async (req, res) => {
  try {
    const id = req.params.id;

    // Doctors can only update their own profile
    if (req.user.role === "doctor" && Number(req.user.id) !== Number(id)) {
      return res.status(403).json({ success: false, message: "Doctors can only update their own profile." });
    }

    const [currentRows] = await pool.query("SELECT * FROM doctors WHERE doctor_id = ?", [id]);
    if (currentRows.length === 0) return res.status(404).json({ success: false, message: "Doctor not found." });

    const b = req.body;
    const fields = [];
    const params = [];

    if (b.name !== undefined)                { fields.push("doctor_name = ?");         params.push(b.name.trim()); }
    if (b.doctor_name !== undefined)          { fields.push("doctor_name = ?");         params.push(b.doctor_name.trim()); }
    if (b.specialization !== undefined)       { fields.push("specialization = ?");      params.push(b.specialization.trim()); }
    if (b.experience !== undefined)           { fields.push("experience = ?");          params.push(Number(b.experience)); }
    if (b.consultation_fee !== undefined)     { fields.push("consultation_fee = ?");    params.push(Number(b.consultation_fee)); }
    if (b.availability_status !== undefined)  { fields.push("availability_status = ?"); params.push(b.availability_status); }
    if (b.is_active !== undefined && req.user.role === "admin") {
      fields.push("is_active = ?");
      params.push(b.is_active ? 1 : 0);
      if (!b.is_active) fields.push("availability_status = 'Busy'");
    }
    if (b.email !== undefined)        { fields.push("email = ?");         params.push(b.email ? b.email.trim().toLowerCase() : null); }
    if (b.phone !== undefined)        { fields.push("phone = ?");         params.push(b.phone || ""); }
    if (b.qualification !== undefined){ fields.push("qualification = ?"); params.push(b.qualification || ""); }
    if (b.about !== undefined)        { fields.push("about = ?");         params.push(b.about || ""); }
    if (b.slots !== undefined) {
      fields.push("slots = ?");
      params.push(JSON.stringify(Array.isArray(b.slots) ? b.slots : DEFAULT_SLOTS));
    }

    if (fields.length > 0) {
      params.push(id);
      await pool.query(`UPDATE doctors SET ${fields.join(", ")} WHERE doctor_id = ?`, params);
    }

    const [updatedRows] = await pool.query("SELECT * FROM doctors WHERE doctor_id = ?", [id]);
    res.json({ success: true, doctor: formatDoctor(updatedRows[0]) });
  } catch (err) {
    console.error("Update doctor error:", err);
    res.status(500).json({ success: false, message: "Failed to update doctor: " + err.message });
  }
});

// ==========================================
// PATIENTS
// ==========================================

// POST /patients — public (registration via auth service, but also proxied here for backward compat)
app.post("/patients", async (req, res) => {
  try {
    const { first_name, last_name, email, phone, date_of_birth, password } = req.body;
    if (!first_name || !last_name || !email) {
      return res.status(400).json({ success: false, message: "First name, last name, and email are required." });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const fullName = `${first_name.trim()} ${last_name.trim()}`;
    const [existing] = await pool.query("SELECT patient_id FROM patients WHERE LOWER(email) = ?", [cleanEmail]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: "An account already uses that email address." });
    }
    const todayStr = new Date().toISOString().split("T")[0];
    const [result] = await pool.query(`
      INSERT INTO patients (patient_name, email, phone, password, date_of_birth, registered_on, blood_group, medical_notes)
      VALUES (?, ?, ?, ?, ?, ?, 'O+', '')
    `, [fullName, cleanEmail, phone || "", password || "demo123", date_of_birth || "2000-01-01", todayStr]);
    const newId = result.insertId;
    res.status(201).json({
      success: true,
      patient: { patient_id: newId, first_name, last_name, email: cleanEmail, phone: phone || "" },
      session: { role: "patient", id: newId, name: fullName, email: cleanEmail }
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ success: false, message: "Failed to register patient: " + err.message });
  }
});

// GET /patients — admin only
app.get("/patients", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { search = "" } = req.query;
    let query = "SELECT * FROM patients WHERE 1=1";
    const params = [];
    if (search && search.trim()) {
      query += " AND (patient_name LIKE ? OR email LIKE ? OR phone LIKE ?)";
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }
    query += " ORDER BY patient_id ASC";
    const [rows] = await pool.query(query, params);
    res.json({ success: true, patients: rows.map(formatPatient) });
  } catch (err) {
    console.error("Fetch patients error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch patients" });
  }
});

// GET /patients/:id — patient (own) or admin
app.get("/patients/:id", requireAuth, requireRole("patient", "admin", "doctor"), async (req, res) => {
  try {
    // Patients can only fetch their own record
    if (req.user.role === "patient" && Number(req.user.id) !== Number(req.params.id)) {
      return res.status(403).json({ success: false, message: "Patients can only access their own profile." });
    }
    const [rows] = await pool.query("SELECT * FROM patients WHERE patient_id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Patient not found." });
    res.json({ success: true, patient: formatPatient(rows[0]) });
  } catch (err) {
    console.error("Fetch patient error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch patient" });
  }
});

// PUT /patients/:id — patient (own) or admin
app.put("/patients/:id", requireAuth, requireRole("patient", "admin"), async (req, res) => {
  try {
    const id = req.params.id;
    if (req.user.role === "patient" && Number(req.user.id) !== Number(id)) {
      return res.status(403).json({ success: false, message: "Patients can only update their own profile." });
    }
    const { first_name, last_name, email, phone, date_of_birth, blood_group, medical_notes } = req.body;
    const [rows] = await pool.query("SELECT * FROM patients WHERE patient_id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Patient not found." });
    const current = rows[0];
    const fullName = first_name !== undefined || last_name !== undefined
      ? `${first_name || ""} ${last_name || ""}`.trim()
      : current.patient_name;
    await pool.query(`
      UPDATE patients SET patient_name = ?, email = ?, phone = ?, date_of_birth = ?, blood_group = ?, medical_notes = ?
      WHERE patient_id = ?
    `, [
      fullName || current.patient_name,
      email !== undefined ? email : current.email,
      phone !== undefined ? phone : current.phone,
      date_of_birth !== undefined ? date_of_birth : current.date_of_birth,
      blood_group !== undefined ? blood_group : current.blood_group,
      medical_notes !== undefined ? medical_notes : current.medical_notes,
      id
    ]);
    const [updated] = await pool.query("SELECT * FROM patients WHERE patient_id = ?", [id]);
    res.json({ success: true, patient: formatPatient(updated[0]) });
  } catch (err) {
    console.error("Update patient error:", err);
    res.status(500).json({ success: false, message: "Failed to update patient: " + err.message });
  }
});

// GET /patients/:id/stats
app.get("/patients/:id/stats", requireAuth, requireRole("patient", "admin"), async (req, res) => {
  try {
    if (req.user.role === "patient" && Number(req.user.id) !== Number(req.params.id)) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }
    const [rows] = await pool.query(`
      SELECT status, COUNT(*) as count FROM appointments WHERE patient_id = ? GROUP BY status
    `, [req.params.id]);
    const stats = { total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
    rows.forEach(r => {
      const st = (r.status || "").toLowerCase();
      const cnt = Number(r.count);
      stats.total += cnt;
      if (st === "pending") stats.pending += cnt;
      else if (st === "confirmed") stats.confirmed += cnt;
      else if (st === "completed") stats.completed += cnt;
      else if (st === "cancelled") stats.cancelled += cnt;
    });
    res.json({ success: true, stats });
  } catch (err) {
    console.error("Patient stats error:", err);
    res.status(500).json({ success: false, message: "Failed to load patient statistics" });
  }
});

// ==========================================
// APPOINTMENTS
// ==========================================

// GET /appointments
app.get("/appointments", requireAuth, async (req, res) => {
  try {
    const { patient_id, doctor_id, status, date } = req.query;

    // Role-based data scoping: patients see only their own appointments
    let effectivePatientId = patient_id;
    if (req.user.role === "patient") {
      effectivePatientId = req.user.id; // override — patients cannot request other patients' data
    }
    // Doctors see only their appointments
    let effectiveDoctorId = doctor_id;
    if (req.user.role === "doctor") {
      effectiveDoctorId = req.user.id;
    }

    let query = `
      SELECT a.appointment_id, a.patient_id, a.doctor_id, a.appointment_date, a.appointment_time,
             a.reason, a.status, a.booked_on, p.patient_name, p.phone AS patient_phone,
             d.doctor_name, d.specialization, d.consultation_fee
      FROM appointments a
      JOIN patients p ON a.patient_id = p.patient_id
      JOIN doctors d ON a.doctor_id = d.doctor_id
      WHERE 1=1
    `;
    const params = [];

    if (effectivePatientId) { query += " AND a.patient_id = ?"; params.push(Number(effectivePatientId)); }
    if (effectiveDoctorId)  { query += " AND a.doctor_id = ?";  params.push(Number(effectiveDoctorId)); }
    if (status) { query += " AND a.status = ?"; params.push(status); }
    if (date)   { query += " AND a.appointment_date = ?"; params.push(date); }

    query += " ORDER BY a.appointment_date ASC, a.appointment_time ASC";

    const [rows] = await pool.query(query, params);
    res.json({ success: true, appointments: rows.map(formatAppointment) });
  } catch (err) {
    console.error("List appointments error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch appointments" });
  }
});

// POST /appointments — patient only
app.post("/appointments", requireAuth, requireRole("patient"), async (req, res) => {
  try {
    const { patient_id, doctor_id, appointment_date, appointment_time, reason } = req.body;

    if (!patient_id || !doctor_id || !appointment_date || !appointment_time) {
      return res.status(400).json({ success: false, message: "Patient, doctor, date, and time slot are required." });
    }

    // Patients can only book for themselves
    if (Number(req.user.id) !== Number(patient_id)) {
      return res.status(403).json({ success: false, message: "You can only book appointments for yourself." });
    }

    const [doctorRows] = await pool.query("SELECT * FROM doctors WHERE doctor_id = ?", [doctor_id]);
    if (doctorRows.length === 0) return res.status(404).json({ success: false, message: "That doctor is no longer available." });

    const timeDB = formatTimeToDB(appointment_time);

    const [existing] = await pool.query(`
      SELECT appointment_id FROM appointments
      WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status IN ('Pending', 'Confirmed')
    `, [doctor_id, appointment_date, timeDB]);

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: `${doctorRows[0].doctor_name} is already booked at ${appointment_time} on that date. Please pick another slot.`
      });
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const [insertResult] = await pool.query(`
      INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason, status, booked_on)
      VALUES (?, ?, ?, ?, ?, 'Pending', ?)
    `, [Number(patient_id), Number(doctor_id), appointment_date, timeDB, reason || "General consultation", todayStr]);

    const [rows] = await pool.query(`
      SELECT a.appointment_id, a.patient_id, a.doctor_id, a.appointment_date, a.appointment_time,
             a.reason, a.status, a.booked_on, p.patient_name, p.phone AS patient_phone,
             d.doctor_name, d.specialization, d.consultation_fee
      FROM appointments a
      JOIN patients p ON a.patient_id = p.patient_id
      JOIN doctors d ON a.doctor_id = d.doctor_id
      WHERE a.appointment_id = ?
    `, [insertResult.insertId]);

    res.status(201).json({ success: true, appointment: formatAppointment(rows[0]) });
  } catch (err) {
    console.error("Create appointment error:", err);
    res.status(500).json({ success: false, message: "Failed to book appointment: " + err.message });
  }
});

// PATCH /appointments/:id/status — doctor or admin
app.patch("/appointments/:id/status", requireAuth, requireRole("doctor", "admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ["Pending", "Confirmed", "Completed", "Cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid appointment status." });
    }
    const [check] = await pool.query("SELECT appointment_id, doctor_id FROM appointments WHERE appointment_id = ?", [id]);
    if (check.length === 0) return res.status(404).json({ success: false, message: "Appointment not found." });

    // Doctors can only update their own appointments
    if (req.user.role === "doctor" && Number(req.user.id) !== Number(check[0].doctor_id)) {
      return res.status(403).json({ success: false, message: "You can only manage your own appointments." });
    }

    await pool.query("UPDATE appointments SET status = ? WHERE appointment_id = ?", [status, id]);

    const [rows] = await pool.query(`
      SELECT a.appointment_id, a.patient_id, a.doctor_id, a.appointment_date, a.appointment_time,
             a.reason, a.status, a.booked_on, p.patient_name, p.phone AS patient_phone,
             d.doctor_name, d.specialization, d.consultation_fee
      FROM appointments a
      JOIN patients p ON a.patient_id = p.patient_id
      JOIN doctors d ON a.doctor_id = d.doctor_id
      WHERE a.appointment_id = ?
    `, [id]);

    res.json({ success: true, appointment: formatAppointment(rows[0]) });
  } catch (err) {
    console.error("Update appointment status error:", err);
    res.status(500).json({ success: false, message: "Failed to update appointment: " + err.message });
  }
});

// ==========================================
// ADMIN STATISTICS
// ==========================================
app.get("/admin/stats", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const [[{ patientCount }]] = await pool.query("SELECT COUNT(*) as patientCount FROM patients");
    const [[{ doctorCount  }]] = await pool.query("SELECT COUNT(*) as doctorCount FROM doctors WHERE is_active = 1");

    const [statusRows] = await pool.query(`SELECT status, COUNT(*) as count FROM appointments GROUP BY status`);
    const appointments = { total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
    statusRows.forEach(r => {
      const st  = (r.status || "").toLowerCase();
      const cnt = Number(r.count);
      appointments.total += cnt;
      if (st === "pending") appointments.pending += cnt;
      else if (st === "confirmed") appointments.confirmed += cnt;
      else if (st === "completed") appointments.completed += cnt;
      else if (st === "cancelled") appointments.cancelled += cnt;
    });

    const [specRows] = await pool.query(`
      SELECT d.specialization as label, COUNT(a.appointment_id) as count
      FROM appointments a JOIN doctors d ON a.doctor_id = d.doctor_id
      GROUP BY d.specialization ORDER BY count DESC
    `);

    const [recentAppts] = await pool.query(`
      SELECT a.appointment_id, a.status, a.booked_on, p.patient_name, d.doctor_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.patient_id
      JOIN doctors d ON a.doctor_id = d.doctor_id
      ORDER BY a.appointment_id DESC LIMIT 5
    `);

    const activity = recentAppts.map(r => {
      let icon = "calendar-plus";
      let text = `${r.patient_name} booked with ${r.doctor_name}`;
      if (r.status === "Completed") { icon = "check"; text = `${r.doctor_name} completed a visit with ${r.patient_name}`; }
      else if (r.status === "Cancelled") { icon = "x"; text = `Appointment with ${r.doctor_name} was cancelled`; }
      else if (r.status === "Confirmed") { icon = "check"; text = `${r.doctor_name} confirmed appointment for ${r.patient_name}`; }
      return { icon, text, when: r.booked_on ? String(r.booked_on).substring(0, 10) : "Recent" };
    });

    res.json({
      success: true,
      stats: {
        patients: Number(patientCount),
        doctors:  Number(doctorCount),
        appointments,
        bySpecialization: specRows.map(r => ({ label: r.label, count: Number(r.count) })),
        activity: activity.length > 0 ? activity : [{ icon: "activity", text: "System initialized and operational", when: "Today" }]
      }
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    res.status(500).json({ success: false, message: "Failed to load admin statistics" });
  }
});

// ==========================================
// START
// ==========================================
const PORT = process.env.PORT || 5002;
pool.getConnection()
  .then(conn => {
    console.log("✅ Appointment Service — MySQL connected");
    conn.release();
  })
  .catch(err => console.error("❌ Appointment Service — MySQL connection failed:", err.message));

app.listen(PORT, () => {
  console.log(`📅 Appointment Service running at http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
});
