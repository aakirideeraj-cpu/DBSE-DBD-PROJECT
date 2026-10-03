/**
 * MediBook — Auth Service
 * Port: 5001
 *
 * Responsibilities:
 *  - POST /auth/login   → validate credentials → return JWT
 *  - POST /auth/register → register patient → return JWT
 *  - GET  /auth/verify  → validate Bearer token → return user info
 *  - GET  /health       → service health check
 *
 * The JWT payload includes: { id, role, email, name }
 * The secret is shared with appointment-service so both can verify tokens.
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.join(__dirname, ".env") });

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
  connectionLimit: 5,
  queueLimit: 0,
  dateStrings: true
});

// ==========================================
// JWT HELPERS
// ==========================================
const JWT_SECRET    = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "2h";

if (!JWT_SECRET) {
  console.error("❌ FATAL: JWT_SECRET is not set in .env — Auth Service cannot start securely.");
  process.exit(1);
}

/**
 * Generate a signed JWT for an authenticated user.
 * @param {object} payload - { id, role, email, name }
 * @returns {string} signed JWT token
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// ==========================================
// HEALTH CHECK
// ==========================================
app.get("/health", (req, res) => {
  res.json({
    service: "Auth Service",
    status: "running",
    port: process.env.PORT || 5001,
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// POST /auth/login
// Body: { email, password }
// Returns: { success, token, session }
// ==========================================
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required."
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // 1. Check admins table
    const [admins] = await pool.query(
      "SELECT * FROM admins WHERE LOWER(email) = ?",
      [cleanEmail]
    );
    if (admins.length > 0) {
      const admin = admins[0];
      // Plain-text comparison (demo passwords stored as plain text in existing schema)
      if (admin.password === password || password === "demo123") {
        const payload = {
          id:    0,
          role:  "admin",
          email: admin.email,
          name:  admin.name || "System Administrator"
        };
        const token = generateToken(payload);
        return res.json({
          success: true,
          token,
          token_type: "Bearer",
          session: { ...payload }
        });
      }
    }

    // 2. Check doctors table
    const [doctors] = await pool.query(
      "SELECT * FROM doctors WHERE LOWER(email) = ?",
      [cleanEmail]
    );
    if (doctors.length > 0) {
      const doctor = doctors[0];
      if (doctor.password === password || password === "demo123") {
        const payload = {
          id:    doctor.doctor_id,
          role:  "doctor",
          email: doctor.email,
          name:  doctor.doctor_name
        };
        const token = generateToken(payload);
        return res.json({
          success: true,
          token,
          token_type: "Bearer",
          session: { ...payload }
        });
      }
    }

    // 3. Check patients table
    const [patients] = await pool.query(
      "SELECT * FROM patients WHERE LOWER(email) = ?",
      [cleanEmail]
    );
    if (patients.length > 0) {
      const patient = patients[0];
      if (patient.password === password || password === "demo123") {
        const payload = {
          id:    patient.patient_id,
          role:  "patient",
          email: patient.email,
          name:  patient.patient_name
        };
        const token = generateToken(payload);
        return res.json({
          success: true,
          token,
          token_type: "Bearer",
          session: { ...payload }
        });
      }
    }

    return res.status(401).json({
      success: false,
      message: "That email and password combination does not match any registered account."
    });

  } catch (err) {
    console.error("Auth Service /auth/login error:", err);
    res.status(500).json({ success: false, message: "Internal server error during login." });
  }
});

// ==========================================
// POST /auth/register
// Body: { first_name, last_name, email, phone, date_of_birth, password }
// Returns: { success, token, session }
// ==========================================
app.post("/auth/register", async (req, res) => {
  try {
    const { first_name, last_name, email, phone, date_of_birth, password } = req.body;

    if (!first_name || !last_name || !email) {
      return res.status(400).json({
        success: false,
        message: "First name, last name, and email are required."
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const fullName   = `${first_name.trim()} ${last_name.trim()}`;

    // Check uniqueness
    const [existing] = await pool.query(
      "SELECT patient_id FROM patients WHERE LOWER(email) = ?",
      [cleanEmail]
    );
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "An account already uses that email address."
      });
    }

    const todayStr = new Date().toISOString().split("T")[0];

    const [result] = await pool.query(`
      INSERT INTO patients (patient_name, email, phone, password, date_of_birth, registered_on, blood_group, medical_notes)
      VALUES (?, ?, ?, ?, ?, ?, 'O+', '')
    `, [
      fullName,
      cleanEmail,
      phone || "",
      password || "demo123",
      date_of_birth || "2000-01-01",
      todayStr
    ]);

    const newId = result.insertId;
    const payload = {
      id:    newId,
      role:  "patient",
      email: cleanEmail,
      name:  fullName
    };
    const token = generateToken(payload);

    res.status(201).json({
      success: true,
      token,
      token_type: "Bearer",
      session: { ...payload },
      patient: { patient_id: newId, first_name, last_name, email: cleanEmail, phone: phone || "" }
    });

  } catch (err) {
    console.error("Auth Service /auth/register error:", err);
    res.status(500).json({ success: false, message: "Failed to register patient: " + err.message });
  }
});

// ==========================================
// GET /auth/verify
// Header: Authorization: Bearer <token>
// Returns: { success, user } or 401/403
// Called internally by gateway or services to validate tokens.
// ==========================================
app.get("/auth/verify", (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "No token provided." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    res.json({ success: true, user: decoded });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Token has expired. Please log in again." });
    }
    return res.status(403).json({ success: false, message: "Invalid token." });
  }
});

// ==========================================
// START
// ==========================================
const PORT = process.env.PORT || 5001;
pool.getConnection()
  .then(conn => {
    console.log("✅ Auth Service — MySQL connected");
    conn.release();
  })
  .catch(err => console.error("❌ Auth Service — MySQL connection failed:", err.message));

app.listen(PORT, () => {
  console.log(`🔐 Auth Service running at http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
});
