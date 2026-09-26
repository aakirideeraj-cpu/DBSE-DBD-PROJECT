/* ==========================================================================
   MediBook — data.js
   ALL mock data lives here and nowhere else.

   Field names deliberately mirror the planned MySQL schema so that when the
   Node/Express backend is ready, only js/api.js changes — nothing in the
   views needs touching.

   Fields marked  // MOCK-ONLY  do NOT exist in the ER diagram yet. They are
   here purely so the frontend has something to render. Either add the column
   to the database or delete the field before backend integration.
   ========================================================================== */

/* Relative-date helper so the demo always has appointments in the future,
   no matter when your professor opens it. */
function dayOffset(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];   // YYYY-MM-DD, same as MySQL DATE
}

const SPECIALIZATIONS = [
  'Cardiologist',
  'Dermatologist',
  'Orthopedic',
  'Neurologist',
  'Pediatrician',
  'General Physician'
];

const APPOINTMENT_STATUSES = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];
const AVAILABILITY_STATUSES = ['Available', 'Busy', 'On Leave'];

/* Standard consultation slots. In the real system these would come from a
   doctor_schedule table keyed by doctor_id and weekday. */
const DEFAULT_SLOTS = [
  '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'
];

/* --------------------------------------------------------------------------
   PATIENTS  →  table `patient`
   -------------------------------------------------------------------------- */
const PATIENTS = [
  {
    patient_id: 1,
    first_name: 'Rahul',
    last_name: 'Sharma',
    email: 'rahul@example.com',
    phone: '+91 98765 43210',
    date_of_birth: '2005-06-15',
    blood_group: 'O+',              // MOCK-ONLY
    medical_notes: 'Allergic to penicillin.', // MOCK-ONLY
    registered_on: '2026-01-12'     // MOCK-ONLY (maps to created_at if added)
  },
  {
    patient_id: 2,
    first_name: 'Ananya',
    last_name: 'Nair',
    email: 'ananya.nair@example.com',
    phone: '+91 90123 44567',
    date_of_birth: '1998-02-09',
    blood_group: 'A+',
    medical_notes: '',
    registered_on: '2026-02-03'
  },
  {
    patient_id: 3,
    first_name: 'Imran',
    last_name: 'Qureshi',
    email: 'imran.q@example.com',
    phone: '+91 99880 11223',
    date_of_birth: '1987-11-21',
    blood_group: 'B+',
    medical_notes: 'Type 2 diabetes, on metformin.',
    registered_on: '2026-02-17'
  },
  {
    patient_id: 4,
    first_name: 'Sneha',
    last_name: 'Patil',
    email: 'sneha.patil@example.com',
    phone: '+91 97654 32109',
    date_of_birth: '2001-08-30',
    blood_group: 'AB-',
    medical_notes: '',
    registered_on: '2026-03-05'
  },
  {
    patient_id: 5,
    first_name: 'Karthik',
    last_name: 'Rao',
    email: 'karthik.rao@example.com',
    phone: '+91 93456 78901',
    date_of_birth: '1994-04-12',
    blood_group: 'O-',
    medical_notes: 'Mild asthma.',
    registered_on: '2026-03-28'
  }
];

/* --------------------------------------------------------------------------
   DOCTORS  →  table `doctor`
   consultation_fee is a NUMBER (the prototype stored "₹800" as a string,
   which made it impossible to sort or total).
   -------------------------------------------------------------------------- */
const DOCTORS = [
  {
    doctor_id: 101,
    name: 'Dr. Ravi Kumar',
    specialization: 'Cardiologist',
    experience: 10,
    consultation_fee: 800,
    availability_status: 'Available',
    email: 'ravi.kumar@medibook.test',   // MOCK-ONLY (needed for doctor login)
    phone: '+91 98800 10101',            // MOCK-ONLY
    qualification: 'MBBS, MD (Cardiology)', // MOCK-ONLY
    about: 'Treats hypertension, arrhythmia and post-operative cardiac care.', // MOCK-ONLY
    slots: [...DEFAULT_SLOTS],           // MOCK-ONLY (future doctor_schedule table)
    is_active: true                      // MOCK-ONLY (soft delete flag for admin)
  },
  {
    doctor_id: 102,
    name: 'Dr. Priya Sharma',
    specialization: 'Dermatologist',
    experience: 8,
    consultation_fee: 600,
    availability_status: 'Available',
    email: 'priya.sharma@medibook.test',
    phone: '+91 98800 10202',
    qualification: 'MBBS, MD (Dermatology)',
    about: 'Focus on chronic acne, eczema and paediatric skin conditions.',
    slots: ['10:00 AM', '11:00 AM', '12:00 PM', '03:00 PM', '04:00 PM'],
    is_active: true
  },
  {
    doctor_id: 103,
    name: 'Dr. Arjun Mehta',
    specialization: 'Orthopedic',
    experience: 12,
    consultation_fee: 900,
    availability_status: 'Available',
    email: 'arjun.mehta@medibook.test',
    phone: '+91 98800 10303',
    qualification: 'MBBS, MS (Orthopaedics)',
    about: 'Sports injuries, joint replacement and fracture management.',
    slots: ['09:00 AM', '10:00 AM', '02:00 PM', '03:00 PM', '05:00 PM'],
    is_active: true
  },
  {
    doctor_id: 104,
    name: 'Dr. Sneha Reddy',
    specialization: 'Neurologist',
    experience: 15,
    consultation_fee: 1200,
    availability_status: 'On Leave',
    email: 'sneha.reddy@medibook.test',
    phone: '+91 98800 10404',
    qualification: 'MBBS, DM (Neurology)',
    about: 'Migraine, epilepsy and movement disorders.',
    slots: ['11:00 AM', '12:00 PM'],
    is_active: true
  },
  {
    doctor_id: 105,
    name: 'Dr. Vikram Singh',
    specialization: 'Pediatrician',
    experience: 7,
    consultation_fee: 500,
    availability_status: 'Available',
    email: 'vikram.singh@medibook.test',
    phone: '+91 98800 10505',
    qualification: 'MBBS, DCH',
    about: 'Routine child health checks, immunisation and growth monitoring.',
    slots: [...DEFAULT_SLOTS],
    is_active: true
  },
  {
    doctor_id: 106,
    name: 'Dr. Ananya Iyer',
    specialization: 'Dermatologist',
    experience: 5,
    consultation_fee: 650,
    availability_status: 'Busy',
    email: 'ananya.iyer@medibook.test',
    phone: '+91 98800 10606',
    qualification: 'MBBS, DDVL',
    about: 'Cosmetic dermatology and hair-loss treatment.',
    slots: ['02:00 PM', '03:00 PM', '04:00 PM'],
    is_active: true
  },
  {
    doctor_id: 107,
    name: 'Dr. Meera Joshi',
    specialization: 'General Physician',
    experience: 9,
    consultation_fee: 400,
    availability_status: 'Available',
    email: 'meera.joshi@medibook.test',
    phone: '+91 98800 10707',
    qualification: 'MBBS, MD (General Medicine)',
    about: 'First point of contact for fever, infection and chronic care.',
    slots: [...DEFAULT_SLOTS],
    is_active: true
  }
];

/* --------------------------------------------------------------------------
   APPOINTMENTS  →  table `appointment`
   -------------------------------------------------------------------------- */
const APPOINTMENTS = [
  { appointment_id: 1, patient_id: 1, doctor_id: 101, appointment_date: dayOffset(3),  appointment_time: '10:00 AM', reason: 'Chest tightness after exercise', status: 'Confirmed', booked_on: dayOffset(-4) },
  { appointment_id: 2, patient_id: 1, doctor_id: 102, appointment_date: dayOffset(6),  appointment_time: '11:00 AM', reason: 'Recurring rash on forearm',       status: 'Pending',   booked_on: dayOffset(-1) },
  { appointment_id: 3, patient_id: 1, doctor_id: 105, appointment_date: dayOffset(-9), appointment_time: '09:00 AM', reason: 'Annual health check',            status: 'Completed', booked_on: dayOffset(-16) },
  { appointment_id: 4, patient_id: 1, doctor_id: 103, appointment_date: dayOffset(-2), appointment_time: '03:00 PM', reason: 'Knee pain while climbing stairs', status: 'Cancelled', booked_on: dayOffset(-8) },
  { appointment_id: 5, patient_id: 2, doctor_id: 101, appointment_date: dayOffset(0),  appointment_time: '02:00 PM', reason: 'Follow-up on BP medication',      status: 'Confirmed', booked_on: dayOffset(-5) },
  { appointment_id: 6, patient_id: 3, doctor_id: 101, appointment_date: dayOffset(0),  appointment_time: '04:00 PM', reason: 'Palpitations at night',           status: 'Pending',   booked_on: dayOffset(-1) },
  { appointment_id: 7, patient_id: 4, doctor_id: 101, appointment_date: dayOffset(2),  appointment_time: '11:00 AM', reason: 'ECG report review',               status: 'Pending',   booked_on: dayOffset(0) },
  { appointment_id: 8, patient_id: 5, doctor_id: 101, appointment_date: dayOffset(-6), appointment_time: '10:00 AM', reason: 'Cholesterol consultation',        status: 'Completed', booked_on: dayOffset(-13) },
  { appointment_id: 9, patient_id: 2, doctor_id: 104, appointment_date: dayOffset(8),  appointment_time: '11:00 AM', reason: 'Frequent migraines',              status: 'Pending',   booked_on: dayOffset(-1) },
  { appointment_id: 10, patient_id: 3, doctor_id: 107, appointment_date: dayOffset(-1), appointment_time: '09:00 AM', reason: 'Persistent fever',               status: 'Completed', booked_on: dayOffset(-3) },
  { appointment_id: 11, patient_id: 5, doctor_id: 103, appointment_date: dayOffset(4),  appointment_time: '02:00 PM', reason: 'Shoulder physiotherapy review',  status: 'Confirmed', booked_on: dayOffset(-2) },
  { appointment_id: 12, patient_id: 4, doctor_id: 106, appointment_date: dayOffset(-5), appointment_time: '03:00 PM', reason: 'Hair-fall consultation',         status: 'Cancelled', booked_on: dayOffset(-11) }
];

/* --------------------------------------------------------------------------
   DEMO ACCOUNTS
   These exist ONLY to let a marker walk through all three panels. There is no
   authentication here: the password is compared in plain JavaScript in the
   browser, which anyone can read. Real login must be a POST /api/login that
   verifies a bcrypt hash on the server and returns a token.
   -------------------------------------------------------------------------- */
const DEMO_ACCOUNTS = [
  { email: 'rahul@example.com',        password: 'demo123', role: 'patient', ref_id: 1 },
  { email: 'ravi.kumar@medibook.test', password: 'demo123', role: 'doctor',  ref_id: 101 },
  { email: 'admin@medibook.test',      password: 'demo123', role: 'admin',   ref_id: 0, name: 'System Administrator' }
];

/* --------------------------------------------------------------------------
   ACTIVITY LOG (admin dashboard) — MOCK-ONLY.
   A real system would derive this from an audit table or from created_at /
   updated_at timestamps.
   -------------------------------------------------------------------------- */
const ACTIVITY = [
  { icon: 'calendar-plus', text: 'Sneha Patil booked with Dr. Ravi Kumar',  when: 'Today, 09:14' },
  { icon: 'check',         text: 'Dr. Meera Joshi completed a consultation', when: 'Yesterday, 17:40' },
  { icon: 'user-plus',     text: 'Karthik Rao registered as a patient',      when: '2 days ago' },
  { icon: 'x',             text: 'Sneha Patil cancelled with Dr. Ananya Iyer', when: '5 days ago' },
  { icon: 'stethoscope',   text: 'Dr. Sneha Reddy marked On Leave',          when: '6 days ago' }
];
