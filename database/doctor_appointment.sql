CREATE DATABASE IF NOT EXISTS appointment_db;
USE appointment_db;

CREATE TABLE IF NOT EXISTS patients (
    patient_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(15),
    dob DATE,
    blood_group VARCHAR(5),
    medical_notes VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS doctors (
    doctor_id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_name VARCHAR(100) NOT NULL,
    specialization VARCHAR(100) NOT NULL,
    consultation_fee DECIMAL(10,2) NOT NULL,
    experience INT NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS appointments (
    appointment_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    reason VARCHAR(255),
    status VARCHAR(20) DEFAULT 'confirmed',
    CONSTRAINT fk_appointment_patient FOREIGN KEY (patient_id)
        REFERENCES patients(patient_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_appointment_doctor FOREIGN KEY (doctor_id)
        REFERENCES doctors(doctor_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT uq_doctor_slot UNIQUE (doctor_id, appointment_date, appointment_time)
);

INSERT IGNORE INTO patients
(patient_name,email,phone,dob,blood_group,medical_notes) VALUES
('Aarav Kumar','aarav@gmail.com','9876543210','2003-05-12','O+','Regular health checkup'),
('Ananya Sharma','ananya@gmail.com','9876543211','2002-08-21','A+','Skin allergy consultation'),
('Rahul Reddy','rahul@gmail.com','9876543212','2001-11-05','B+','General consultation');

INSERT IGNORE INTO doctors
(doctor_name,specialization,consultation_fee,experience,email) VALUES
('Dr. Ravi Kumar','Cardiologist',800.00,10,'ravi@hospital.com'),
('Dr. Priya Sharma','Dermatologist',600.00,8,'priya@hospital.com'),
('Dr. Arjun Mehta','Orthopedic',900.00,12,'arjun@hospital.com'),
('Dr. Sneha Reddy','Neurologist',1200.00,15,'sneha@hospital.com'),
('Dr. Vikram Singh','Pediatrician',500.00,7,'vikram@hospital.com'),
('Dr. Ananya Iyer','Dermatologist',650.00,5,'ananya.iyer@hospital.com');

INSERT IGNORE INTO appointments
(patient_id,doctor_id,appointment_date,appointment_time,reason,status) VALUES
(1,1,'2026-10-05','10:00:00','Routine heart checkup','confirmed'),
(2,2,'2026-10-06','11:00:00','Skin consultation','confirmed'),
(3,3,'2026-10-07','14:00:00','Joint pain consultation','confirmed');

CREATE INDEX idx_doctor_specialization ON doctors(specialization);
CREATE INDEX idx_appointment_date ON appointments(appointment_date);
CREATE INDEX idx_appointment_patient ON appointments(patient_id);
CREATE INDEX idx_appointment_doctor ON appointments(doctor_id);

CREATE OR REPLACE VIEW appointment_details AS
SELECT a.appointment_id,p.patient_name,d.doctor_name,d.specialization,
       d.consultation_fee,a.appointment_date,a.appointment_time,a.reason,a.status
FROM appointments a
JOIN patients p ON a.patient_id=p.patient_id
JOIN doctors d ON a.doctor_id=d.doctor_id;

CREATE OR REPLACE VIEW doctor_statistics AS
SELECT d.doctor_id,d.doctor_name,d.specialization,
       COUNT(a.appointment_id) AS total_appointments
FROM doctors d
LEFT JOIN appointments a ON d.doctor_id=a.doctor_id
GROUP BY d.doctor_id,d.doctor_name,d.specialization;

DELIMITER //
CREATE PROCEDURE GetPatientAppointments(IN p_patient_id INT)
BEGIN
    SELECT * FROM appointment_details
    WHERE patient_name=(SELECT patient_name FROM patients WHERE patient_id=p_patient_id)
    ORDER BY appointment_date,appointment_time;
END //
DELIMITER ;

DELIMITER //
CREATE PROCEDURE SearchDoctors(IN p_specialization VARCHAR(100))
BEGIN
    SELECT * FROM doctors
    WHERE specialization=p_specialization
    ORDER BY experience DESC;
END //
DELIMITER ;

DELIMITER //
CREATE TRIGGER before_appointment_insert
BEFORE INSERT ON appointments
FOR EACH ROW
BEGIN
    IF NEW.appointment_date < CURDATE() THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT='Appointment date cannot be in the past';
    END IF;
END //
DELIMITER ;
