-- ============================================================================
-- MediBook — Doctor Appointment Booking System
-- Database Systems Engineering / Database Design (DBSE-DBD) Project
-- Full Database Schema Definition (DDL)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS appointment_db;
USE appointment_db;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS doctors;
DROP TABLE IF EXISTS admins;
DROP VIEW IF EXISTS appointment_details;
SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- 1. Table: admins
-- Represents clinic and system administrators
-- ----------------------------------------------------------------------------
CREATE TABLE admins (
    admin_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 2. Table: doctors
-- Stores verified medical practitioners, specialties, fee, and availability
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 3. Table: patients
-- Stores patient personal, demographic, and medical background data
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 4. Table: appointments
-- Stores scheduled consultations linking patients to doctors
-- Enforces double-booking prevention via UNIQUE (doctor_id, appointment_date, appointment_time)
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 5. View: appointment_details
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
-- 6. Stored Procedures
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
