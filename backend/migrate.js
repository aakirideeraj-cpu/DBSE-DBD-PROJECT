const pool = require("./db");

const DEFAULT_SLOTS = JSON.stringify([
  "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"
]);

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0].count > 0;
}

async function runMigration() {
  console.log("Starting database schema enhancements...");

  await pool.query("SET FOREIGN_KEY_CHECKS = 0");

  // 1. Upgrade doctors table
  if (!(await columnExists("doctors", "phone"))) {
    await pool.query("ALTER TABLE doctors ADD COLUMN phone VARCHAR(20) DEFAULT '+91 98800 10101'");
    console.log("Added phone to doctors");
  }
  if (!(await columnExists("doctors", "qualification"))) {
    await pool.query("ALTER TABLE doctors ADD COLUMN qualification VARCHAR(100) DEFAULT 'MBBS, MD'");
    console.log("Added qualification to doctors");
  }
  if (!(await columnExists("doctors", "about"))) {
    await pool.query("ALTER TABLE doctors ADD COLUMN about TEXT DEFAULT NULL");
    console.log("Added about to doctors");
  }
  if (!(await columnExists("doctors", "availability_status"))) {
    await pool.query("ALTER TABLE doctors ADD COLUMN availability_status VARCHAR(20) DEFAULT 'Available'");
    console.log("Added availability_status to doctors");
  }
  if (!(await columnExists("doctors", "is_active"))) {
    await pool.query("ALTER TABLE doctors ADD COLUMN is_active TINYINT(1) DEFAULT 1");
    console.log("Added is_active to doctors");
  }
  if (!(await columnExists("doctors", "slots"))) {
    await pool.query("ALTER TABLE doctors ADD COLUMN slots JSON DEFAULT NULL");
    console.log("Added slots to doctors");
  }
  if (!(await columnExists("doctors", "password"))) {
    await pool.query("ALTER TABLE doctors ADD COLUMN password VARCHAR(100) DEFAULT 'demo123'");
    console.log("Added password to doctors");
  }

  // Set default slots for doctors that don't have slots yet
  await pool.query(`UPDATE doctors SET slots = ? WHERE slots IS NULL`, [DEFAULT_SLOTS]);

  // Modify doctor_id to AUTO_INCREMENT
  try {
    await pool.query("ALTER TABLE doctors MODIFY doctor_id INT NOT NULL AUTO_INCREMENT");
    console.log("doctors.doctor_id set to AUTO_INCREMENT");
  } catch (err) {
    console.error("Error setting doctors AUTO_INCREMENT:", err.message);
  }

  // 2. Upgrade patients table
  if (!(await columnExists("patients", "date_of_birth"))) {
    await pool.query("ALTER TABLE patients ADD COLUMN date_of_birth DATE DEFAULT '2000-01-01'");
    console.log("Added date_of_birth to patients");
  }
  if (!(await columnExists("patients", "blood_group"))) {
    await pool.query("ALTER TABLE patients ADD COLUMN blood_group VARCHAR(10) DEFAULT 'O+'");
    console.log("Added blood_group to patients");
  }
  if (!(await columnExists("patients", "medical_notes"))) {
    await pool.query("ALTER TABLE patients ADD COLUMN medical_notes TEXT DEFAULT NULL");
    console.log("Added medical_notes to patients");
  }
  if (!(await columnExists("patients", "registered_on"))) {
    await pool.query("ALTER TABLE patients ADD COLUMN registered_on DATE DEFAULT (CURRENT_DATE)");
    console.log("Added registered_on to patients");
  }

  // Modify patient_id to AUTO_INCREMENT
  try {
    await pool.query("ALTER TABLE patients MODIFY patient_id INT NOT NULL AUTO_INCREMENT");
    console.log("patients.patient_id set to AUTO_INCREMENT");
  } catch (err) {
    console.error("Error setting patients AUTO_INCREMENT:", err.message);
  }

  // 3. Upgrade appointments table
  if (!(await columnExists("appointments", "reason"))) {
    await pool.query("ALTER TABLE appointments ADD COLUMN reason VARCHAR(255) DEFAULT 'General consultation'");
    console.log("Added reason to appointments");
  }
  if (!(await columnExists("appointments", "booked_on"))) {
    await pool.query("ALTER TABLE appointments ADD COLUMN booked_on DATE DEFAULT (CURRENT_DATE)");
    console.log("Added booked_on to appointments");
  }

  // Modify appointment_id to AUTO_INCREMENT
  try {
    await pool.query("ALTER TABLE appointments MODIFY appointment_id INT NOT NULL AUTO_INCREMENT");
    console.log("appointments.appointment_id set to AUTO_INCREMENT");
  } catch (err) {
    console.error("Error setting appointments AUTO_INCREMENT:", err.message);
  }

  await pool.query("SET FOREIGN_KEY_CHECKS = 1");

  // 4. Create admins table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      admin_id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
  console.log("admins table ensured");

  // Ensure default admin user exists
  await pool.query(`
    INSERT INTO admins (name, email, password)
    VALUES ('System Administrator', 'admin@medibook.test', 'demo123')
    ON DUPLICATE KEY UPDATE name = VALUES(name), password = VALUES(password)
  `);
  console.log("admin user verified");

  // Ensure demo accounts for doctor and patient exist / match frontend demo buttons:
  // Patient: rahul@example.com
  const [patientRahul] = await pool.query("SELECT * FROM patients WHERE email = 'rahul@example.com'");
  if (patientRahul.length === 0) {
    await pool.query(`
      INSERT INTO patients (patient_name, email, phone, age, gender, password, date_of_birth, blood_group, medical_notes, registered_on)
      VALUES ('Rahul Sharma', 'rahul@example.com', '+91 98765 43210', 21, 'Male', 'demo123', '2005-06-15', 'O+', 'Allergic to penicillin.', '2026-01-12')
    `);
    console.log("Demo patient rahul@example.com created");
  } else {
    await pool.query(`UPDATE patients SET password = 'demo123' WHERE email = 'rahul@example.com'`);
  }

  // Also support rahul@gmail.com with demo123 as well as rahul123
  await pool.query("UPDATE patients SET password = 'demo123' WHERE email = 'rahul@gmail.com'");

  // Doctor: ravi.kumar@medibook.test
  const [docRavi] = await pool.query("SELECT * FROM doctors WHERE email = 'ravi.kumar@medibook.test'");
  if (docRavi.length === 0) {
    // Check Doctor 101
    const [doc101] = await pool.query("SELECT * FROM doctors WHERE doctor_id = 101");
    if (doc101.length > 0) {
      await pool.query(`
        UPDATE doctors
        SET doctor_name = 'Dr. Ravi Kumar', email = 'ravi.kumar@medibook.test', password = 'demo123',
            qualification = 'MBBS, MD (Cardiology)', about = 'Treats hypertension, arrhythmia and post-operative cardiac care.',
            experience = 10, consultation_fee = 800, availability_status = 'Available', is_active = 1
        WHERE doctor_id = 101
      `);
      console.log("Updated Doctor 101 to Dr. Ravi Kumar (ravi.kumar@medibook.test)");
    } else {
      await pool.query(`
        INSERT INTO doctors (doctor_id, doctor_name, specialization, consultation_fee, experience, email, phone, qualification, about, availability_status, is_active, password, slots)
        VALUES (101, 'Dr. Ravi Kumar', 'Cardiology', 800, 10, 'ravi.kumar@medibook.test', '+91 98800 10101', 'MBBS, MD (Cardiology)', 'Treats hypertension, arrhythmia and post-operative cardiac care.', 'Available', 1, 'demo123', ?)
      `, [DEFAULT_SLOTS]);
      console.log("Inserted Doctor 101 Dr. Ravi Kumar");
    }
  }

  // Also update appointment_details view to include reason and booked_on
  await pool.query(`
    CREATE OR REPLACE VIEW appointment_details AS
    SELECT
      a.appointment_id,
      p.patient_id,
      p.patient_name,
      p.phone AS patient_phone,
      d.doctor_id,
      d.doctor_name,
      d.specialization,
      d.consultation_fee,
      a.appointment_date,
      a.appointment_time,
      a.reason,
      a.status,
      a.booked_on
    FROM appointments a
    JOIN patients p ON a.patient_id = p.patient_id
    JOIN doctors d ON a.doctor_id = d.doctor_id
  `);
  console.log("appointment_details view updated");

  // Ensure stored procedures
  await pool.query("DROP PROCEDURE IF EXISTS GetDoctorsBySpecialization");
  await pool.query(`
    CREATE PROCEDURE GetDoctorsBySpecialization(IN spec VARCHAR(100))
    BEGIN
      SELECT doctor_id, doctor_name, specialization, consultation_fee, experience, availability_status, email, phone
      FROM doctors
      WHERE specialization = spec AND is_active = 1;
    END
  `);

  await pool.query("DROP PROCEDURE IF EXISTS GetPatientAppointments");
  await pool.query(`
    CREATE PROCEDURE GetPatientAppointments(IN p_id INT)
    BEGIN
      SELECT a.appointment_id, p.patient_name, d.doctor_name, d.specialization,
             a.appointment_date, a.appointment_time, a.reason, a.status, a.booked_on
      FROM appointments a
      JOIN patients p ON a.patient_id = p.patient_id
      JOIN doctors d ON a.doctor_id = d.doctor_id
      WHERE a.patient_id = p_id
      ORDER BY a.appointment_date DESC, a.appointment_time DESC;
    END
  `);

  await pool.query("DROP PROCEDURE IF EXISTS GetDoctorAppointments");
  await pool.query(`
    CREATE PROCEDURE GetDoctorAppointments(IN d_id INT)
    BEGIN
      SELECT a.appointment_id, p.patient_id, p.patient_name, p.phone AS patient_phone,
             a.appointment_date, a.appointment_time, a.reason, a.status, a.booked_on
      FROM appointments a
      JOIN patients p ON a.patient_id = p.patient_id
      WHERE a.doctor_id = d_id
      ORDER BY a.appointment_date ASC, a.appointment_time ASC;
    END
  `);
  console.log("stored procedures ensured");

  console.log("Database schema enhancement completed successfully!");
  process.exit(0);
}

runMigration().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
