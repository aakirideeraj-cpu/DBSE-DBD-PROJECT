-- ============================================================================
-- MediBook — Doctor Appointment Booking System
-- Sample Seed Data
-- ============================================================================

USE appointment_db;

-- ----------------------------------------------------------------------------
-- Admins
-- ----------------------------------------------------------------------------
INSERT INTO admins (name, email, password) VALUES
('System Administrator', 'admin@medibook.test', 'demo123')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ----------------------------------------------------------------------------
-- Doctors
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- Patients
-- ----------------------------------------------------------------------------
INSERT INTO patients (patient_id, patient_name, email, phone, age, gender, password, date_of_birth, blood_group, medical_notes, registered_on) VALUES
(1, 'Rahul Sharma', 'rahul@example.com', '+91 98765 43210', 21, 'Male', 'demo123', '2005-06-15', 'O+', 'Allergic to penicillin.', '2026-01-12'),
(2, 'Deeraj Kumar', 'deeraj@gmail.com', '+91 98765 43211', 19, 'Male', 'demo123', '2007-02-14', 'B+', 'No known allergies.', '2026-01-15'),
(3, 'Ananya Nair', 'ananya@gmail.com', '+91 98765 43212', 21, 'Female', 'demo123', '2005-03-22', 'A+', 'Mild pollen allergy.', '2026-02-03'),
(4, 'Sneha Patil', 'sneha@gmail.com', '+91 98765 43213', 22, 'Female', 'demo123', '2004-08-30', 'AB-', 'Previous fracture on left arm.', '2026-02-17'),
(5, 'Arjun Rao', 'arjun@gmail.com', '+91 98765 43214', 23, 'Male', 'demo123', '2003-11-09', 'O-', 'Mild asthma, carries inhaler.', '2026-03-05')
ON DUPLICATE KEY UPDATE
patient_name=VALUES(patient_name), phone=VALUES(phone);

-- ----------------------------------------------------------------------------
-- Appointments
-- ----------------------------------------------------------------------------
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
