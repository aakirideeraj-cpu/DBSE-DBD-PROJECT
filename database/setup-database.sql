-- ============================================================================
-- MediBook — Doctor Appointment Booking System
-- Database Systems Engineering / Database Design (DBSE-DBD) Project
-- Complete Fresh Installation Database Script (Schema + Stored Procedures + Seeds)
-- ============================================================================
-- PURPOSE:
-- Run this single script on a FRESH MySQL server (via MySQL Workbench or MySQL CLI)
-- to initialize the entire appointment_db database with all tables, constraints,
-- foreign keys, views, stored procedures, and initial sample data.
--
-- CAUTION:
-- Running this script DROPS and RECREATES appointment_db tables.
-- Do NOT execute this on an existing production database containing real data.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Create and Select Database
-- ----------------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS appointment_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

USE appointment_db;

-- ----------------------------------------------------------------------------
-- 2. Drop existing objects in reverse dependency order
-- ----------------------------------------------------------------------------
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS doctors;
DROP TABLE IF EXISTS admins;
DROP VIEW IF EXISTS appointment_details;
DROP PROCEDURE IF EXISTS GetDoctorsBySpecialization;
DROP PROCEDURE IF EXISTS GetPatientAppointments;
DROP PROCEDURE IF EXISTS GetDoctorAppointments;

SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- 3. Table: admins
-- Represents clinic administrators and staff with administrative privileges
-- ----------------------------------------------------------------------------
CREATE TABLE admins (
    admin_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 4. Table: doctors
-- Stores doctor directory, specialization, consulting fee, slots, and availability
-- ----------------------------------------------------------------------------
CREATE TABLE doctors (
    doctor_id INT PRIMARY KEY AUTO_INCREMENT,
    doctor_name VARCHAR(100) NOT NULL,
    specialization VARCHAR(100) NOT NULL,
    consultation_fee DECIMAL(10,2) NOT NULL,
    experience INT DEFAULT 0,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20) DEFAULT '+91 98800 10101',
    qualification VARCHAR(100) DEFAULT 'MBBS, MD',
    about TEXT DEFAULT NULL,
    availability_status VARCHAR(20) DEFAULT 'Available',
    is_active TINYINT(1) DEFAULT 1,
    slots JSON DEFAULT NULL,
    password VARCHAR(100) DEFAULT 'demo123',
    CONSTRAINT doctors_chk_fee CHECK (consultation_fee > 0),
    CONSTRAINT doctors_chk_exp CHECK (experience >= 0),
    CONSTRAINT doctors_chk_avail CHECK (availability_status IN ('Available', 'Busy', 'On Leave'))
) ENGINE=InnoDB AUTO_INCREMENT=101 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 5. Table: patients
-- Stores patient demographics, contact details, blood group, and medical notes
-- ----------------------------------------------------------------------------
CREATE TABLE patients (
    patient_id INT PRIMARY KEY AUTO_INCREMENT,
    patient_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(15) NOT NULL,
    age INT DEFAULT NULL,
    gender VARCHAR(10) DEFAULT NULL,
    password VARCHAR(100) NOT NULL,
    date_of_birth DATE DEFAULT '2000-01-01',
    blood_group VARCHAR(10) DEFAULT 'O+',
    medical_notes TEXT DEFAULT NULL,
    registered_on DATE DEFAULT (CURRENT_DATE),
    CONSTRAINT patients_chk_age CHECK (age IS NULL OR (age > 0 AND age < 120))
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 6. Table: appointments
-- Stores scheduled consultations linking patients to doctors.
-- Prevents double booking via UNIQUE (doctor_id, appointment_date, appointment_time).
-- ----------------------------------------------------------------------------
CREATE TABLE appointments (
    appointment_id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    reason VARCHAR(255) DEFAULT 'General consultation',
    status VARCHAR(20) DEFAULT 'Pending',
    booked_on DATE DEFAULT (CURRENT_DATE),
    CONSTRAINT appointments_ibfk_1 FOREIGN KEY (patient_id) REFERENCES patients (patient_id) ON DELETE CASCADE,
    CONSTRAINT appointments_ibfk_2 FOREIGN KEY (doctor_id) REFERENCES doctors (doctor_id) ON DELETE CASCADE,
    CONSTRAINT appointments_chk_status CHECK (status IN ('Pending', 'Confirmed', 'Cancelled', 'Completed')),
    UNIQUE KEY uq_doc_slot (doctor_id, appointment_date, appointment_time)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 7. View: appointment_details
-- Denormalized view joining appointments with patient and doctor details
-- ----------------------------------------------------------------------------
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
JOIN doctors d ON a.doctor_id = d.doctor_id;

-- ----------------------------------------------------------------------------
-- 8. Stored Procedures
-- ----------------------------------------------------------------------------

DELIMITER //

DROP PROCEDURE IF EXISTS GetDoctorsBySpecialization //
CREATE PROCEDURE GetDoctorsBySpecialization(IN spec VARCHAR(100))
BEGIN
    SELECT
        doctor_id,
        doctor_name,
        specialization,
        consultation_fee,
        experience,
        availability_status,
        email,
        phone
    FROM doctors
    WHERE specialization = spec AND is_active = 1;
END //

DROP PROCEDURE IF EXISTS GetPatientAppointments //
CREATE PROCEDURE GetPatientAppointments(IN p_id INT)
BEGIN
    SELECT
        a.appointment_id,
        p.patient_name,
        d.doctor_name,
        d.specialization,
        a.appointment_date,
        a.appointment_time,
        a.reason,
        a.status,
        a.booked_on
    FROM appointments a
    JOIN patients p ON a.patient_id = p.patient_id
    JOIN doctors d ON a.doctor_id = d.doctor_id
    WHERE a.patient_id = p_id
    ORDER BY a.appointment_date DESC, a.appointment_time DESC;
END //

DROP PROCEDURE IF EXISTS GetDoctorAppointments //
CREATE PROCEDURE GetDoctorAppointments(IN d_id INT)
BEGIN
    SELECT
        a.appointment_id,
        p.patient_id,
        p.patient_name,
        p.phone AS patient_phone,
        a.appointment_date,
        a.appointment_time,
        a.reason,
        a.status,
        a.booked_on
    FROM appointments a
    JOIN patients p ON a.patient_id = p.patient_id
    WHERE a.doctor_id = d_id
    ORDER BY a.appointment_date ASC, a.appointment_time ASC;
END //

DELIMITER ;

-- ----------------------------------------------------------------------------
-- 9. Sample Seed Data
-- ----------------------------------------------------------------------------

-- 9.1 Admins
INSERT INTO admins (admin_id, name, email, password) VALUES
(1, 'System Administrator', 'admin@medibook.test', 'demo123')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 9.2 Doctors
INSERT INTO doctors (doctor_id, doctor_name, specialization, consultation_fee, experience, email, phone, qualification, about, availability_status, is_active, password, slots) VALUES
(101, 'Dr. Ravi Kumar', 'Cardiologist', 800.00, 10, 'ravi.kumar@medibook.test', '+91 98800 10101', 'MBBS, MD (Cardiology)', 'Treats hypertension, arrhythmia and post-operative cardiac care.', 'Available', 1, 'demo123', '["09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"]'),
(102, 'Dr. Priya Sharma', 'Dermatologist', 600.00, 8, 'priya@hospital.com', '+91 98800 10202', 'MBBS, MD (Dermatology)', 'Focus on chronic acne, eczema and paediatric skin conditions.', 'Available', 1, 'demo123', '["10:00 AM", "11:00 AM", "12:00 PM", "03:00 PM", "04:00 PM"]'),
(103, 'Dr. Arjun Rao', 'Neurologist', 1000.00, 15, 'arjunrao@hospital.com', '+91 98800 10303', 'MBBS, DM (Neurology)', 'Expert in stroke rehabilitation, headaches, and peripheral neuropathy.', 'Available', 1, 'demo123', '["09:00 AM", "10:00 AM", "02:00 PM", "03:00 PM", "05:00 PM"]'),
(104, 'Dr. Meena Reddy', 'Pediatrician', 500.00, 7, 'meena@hospital.com', '+91 98800 10404', 'MBBS, DCH', 'Routine child health checks, immunization and growth monitoring.', 'Available', 1, 'demo123', '["11:00 AM", "12:00 PM", "04:00 PM", "05:00 PM"]'),
(105, 'Dr. Vikram Singh', 'Orthopedic', 900.00, 10, 'vikram@hospital.com', '+91 98800 10505', 'MBBS, MS (Orthopaedics)', 'Sports injuries, joint replacement and fracture management.', 'Available', 1, 'demo123', '["09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"]'),
(106, 'Dr. Kavya Nair', 'Cardiologist', 750.00, 9, 'kavya@hospital.com', '+91 98800 10606', 'MBBS, MD', 'Preventative cardiology and lifestyle cardiovascular management.', 'Busy', 1, 'demo123', '["02:00 PM", "03:00 PM", "04:00 PM"]'),
(107, 'Dr. Rohit Verma', 'Dermatologist', 650.00, 6, 'rohit@hospital.com', '+91 98800 10707', 'MBBS, DDVL', 'Cosmetic dermatology and hair-loss treatment.', 'Available', 1, 'demo123', '["09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "02:00 PM"]'),
(108, 'Dr. Divya Rao', 'Pediatrician', 550.00, 5, 'divya@hospital.com', '+91 98800 10808', 'MBBS, MD (Pediatrics)', 'Neonatal care and child nutrition guidance.', 'On Leave', 1, 'demo123', '["10:00 AM", "11:00 AM", "12:00 PM"]')
ON DUPLICATE KEY UPDATE
doctor_name=VALUES(doctor_name), specialization=VALUES(specialization), consultation_fee=VALUES(consultation_fee);

-- 9.3 Patients
INSERT INTO patients (patient_id, patient_name, email, phone, age, gender, password, date_of_birth, blood_group, medical_notes, registered_on) VALUES
(1, 'Rahul Sharma', 'rahul@example.com', '+91 98765 43210', 21, 'Male', 'demo123', '2005-06-15', 'O+', 'Allergic to penicillin.', '2026-01-12'),
(2, 'Deeraj Kumar', 'deeraj@gmail.com', '+91 98765 43211', 19, 'Male', 'demo123', '2007-02-14', 'B+', 'No known allergies.', '2026-01-15'),
(3, 'Ananya Nair', 'ananya@gmail.com', '+91 98765 43212', 21, 'Female', 'demo123', '2005-03-22', 'A+', 'Mild pollen allergy.', '2026-02-03'),
(4, 'Sneha Patil', 'sneha@gmail.com', '+91 98765 43213', 22, 'Female', 'demo123', '2004-08-30', 'AB-', 'Previous fracture on left arm.', '2026-02-17'),
(5, 'Arjun Rao', 'arjun@gmail.com', '+91 98765 43214', 23, 'Male', 'demo123', '2003-11-09', 'O-', 'Mild asthma, carries inhaler.', '2026-03-05')
ON DUPLICATE KEY UPDATE
patient_name=VALUES(patient_name), phone=VALUES(phone);

-- 9.4 Appointments
INSERT INTO appointments (appointment_id, patient_id, doctor_id, appointment_date, appointment_time, reason, status, booked_on) VALUES
(1, 1, 101, '2026-10-10', '10:00:00', 'Chest tightness after exercise', 'Confirmed', '2026-09-18'),
(2, 2, 102, '2026-10-12', '11:00:00', 'Recurring rash on forearm', 'Pending', '2026-09-19'),
(3, 3, 103, '2026-10-14', '12:00:00', 'Migraine follow-up review', 'Confirmed', '2026-09-15'),
(4, 4, 104, '2026-10-15', '10:30:00', 'Routine pediatrician visit', 'Pending', '2026-09-19'),
(5, 5, 105, '2026-10-16', '14:00:00', 'Knee joint ache consultation', 'Confirmed', '2026-09-17'),
(6, 1, 106, '2026-09-14', '15:00:00', 'Cardiac stress test review', 'Completed', '2026-09-01'),
(7, 2, 107, '2026-10-18', '09:30:00', 'Acne treatment progression', 'Confirmed', '2026-09-16'),
(8, 3, 108, '2026-10-19', '11:30:00', 'Pediatric vaccination check', 'Pending', '2026-09-20'),
(9, 4, 101, '2026-10-20', '16:00:00', 'ECG review and BP consultation', 'Confirmed', '2026-09-14'),
(10, 5, 102, '2026-10-22', '13:00:00', 'Skin allergy follow-up', 'Pending', '2026-09-19')
ON DUPLICATE KEY UPDATE
status=VALUES(status), reason=VALUES(reason);

-- Reset auto increments to continue past seed IDs
ALTER TABLE doctors AUTO_INCREMENT = 109;
ALTER TABLE patients AUTO_INCREMENT = 6;
ALTER TABLE appointments AUTO_INCREMENT = 11;
