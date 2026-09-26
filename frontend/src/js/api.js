/* ==========================================================================
   MediBook — api.js
   THE ONLY FILE THAT TOUCHES DATA.

   Fully integrated with the Node.js/Express + MySQL backend!
   Every function makes real HTTP requests via fetch() to the Express REST API.
   ========================================================================== */

const Api = (() => {

  // Centralized API Base URL
  // 1. Explicit window override (e.g. window.MEDIBOOK_API_URL = 'http://...')
  // 2. Relative '/api' when served directly through Express (e.g. http://localhost:5000)
  // 3. Fallback to 'http://localhost:5000/api' for VS Code Live Server or local file
  function resolveBaseUrl() {
    if (typeof window !== 'undefined' && window.MEDIBOOK_API_URL) {
      return window.MEDIBOOK_API_URL;
    }
    if (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http')) {
      if (window.location.port === '5000' || window.location.pathname.startsWith('/api')) {
        return `${window.location.origin}/api`;
      }
    }
    return 'http://localhost:5000/api';
  }

  const BASE_URL = resolveBaseUrl();

  /* Helper to perform fetch requests with JSON parsing and standardized error handling */
  async function request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (error) {
      // If network fails (e.g. server not running)
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.error(`Network error connecting to backend at ${url}:`, error);
        throw new Error('Unable to connect to the MediBook server. Please make sure the backend is running at http://localhost:5000.');
      }
      throw error;
    }
  }

  /* ======================================================================
     AUTH
     ====================================================================== */

  // POST /api/auth/login
  async function login(email, password) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    return data.session;
  }

  // POST /api/patients (registration)
  async function registerPatient(form) {
    const data = await request('/patients', {
      method: 'POST',
      body: JSON.stringify(form)
    });
    return data.session;
  }

  /* ======================================================================
     DOCTORS
     ====================================================================== */

  // GET /api/doctors?search=&specialization=&includeInactive=
  async function listDoctors({
    search = '',
    specialization = '',
    includeInactive = false
  } = {}) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (specialization) params.set('specialization', specialization);
    if (includeInactive) params.set('includeInactive', 'true');

    const data = await request(`/doctors?${params.toString()}`);
    return data.doctors || [];
  }

  // GET /api/doctors/:id
  async function getDoctor(doctorId) {
    const data = await request(`/doctors/${doctorId}`);
    return data.doctor;
  }

  // POST /api/admin/doctors
  async function createDoctor(form) {
    const data = await request('/admin/doctors', {
      method: 'POST',
      body: JSON.stringify(form)
    });
    return data.doctor;
  }

  // PATCH /api/admin/doctors/:id — also used by the doctor's own profile screen
  async function updateDoctor(doctorId, changes) {
    const data = await request(`/admin/doctors/${doctorId}`, {
      method: 'PATCH',
      body: JSON.stringify(changes)
    });
    return data.doctor;
  }

  // PATCH /api/admin/doctors/:id { is_active: false }
  // Soft delete: keeps historical foreign keys valid
  async function setDoctorActive(doctorId, isActive) {
    const data = await request(`/admin/doctors/${doctorId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive })
    });
    return data.doctor;
  }

  /* ======================================================================
     PATIENTS
     ====================================================================== */

  // GET /api/patients?search=
  async function listPatients({ search = '' } = {}) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);

    const data = await request(`/patients?${params.toString()}`);
    return data.patients || [];
  }

  // GET /api/patients/:id
  async function getPatient(patientId) {
    const data = await request(`/patients/${patientId}`);
    return data.patient;
  }

  // PUT /api/patients/:id
  async function updatePatient(patientId, changes) {
    const data = await request(`/patients/${patientId}`, {
      method: 'PUT',
      body: JSON.stringify(changes)
    });
    return data.patient;
  }

  /* ======================================================================
     APPOINTMENTS
     ====================================================================== */

  // GET /api/appointments?patient_id=&doctor_id=&status=&date=
  async function listAppointments({ patientId, doctorId, status, date } = {}) {
    const params = new URLSearchParams();
    if (patientId !== undefined && patientId !== null && patientId !== '') {
      params.set('patient_id', patientId);
    }
    if (doctorId !== undefined && doctorId !== null && doctorId !== '') {
      params.set('doctor_id', doctorId);
    }
    if (status) params.set('status', status);
    if (date) params.set('date', date);

    const data = await request(`/appointments?${params.toString()}`);
    const list = data.appointments || [];

    // Order chronologically by date and time
    list.sort((a, b) => {
      if (a.appointment_date === b.appointment_date) {
        return Util.timeToMinutes(a.appointment_time) - Util.timeToMinutes(b.appointment_time);
      }
      return a.appointment_date < b.appointment_date ? -1 : 1;
    });

    return list;
  }

  // POST /api/appointments
  async function createAppointment({ patient_id, doctor_id, appointment_date, appointment_time, reason }) {
    const data = await request('/appointments', {
      method: 'POST',
      body: JSON.stringify({
        patient_id,
        doctor_id,
        appointment_date,
        appointment_time,
        reason
      })
    });
    return data.appointment;
  }

  // PATCH /api/appointments/:id/status
  async function updateAppointmentStatus(appointmentId, status) {
    const data = await request(`/appointments/${appointmentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    return data.appointment;
  }

  // GET /api/doctors/:id/slots?date=
  async function getAvailableSlots(doctorId, date) {
    const params = new URLSearchParams({ date });
    const data = await request(`/doctors/${doctorId}/slots?${params.toString()}`);
    return data.slots || [];
  }

  /* ======================================================================
     STATISTICS
     ====================================================================== */

  // GET /api/admin/stats
  async function getAdminStats() {
    const data = await request('/admin/stats');
    return data.stats;
  }

  // GET /api/patients/:id/stats
  async function getPatientStats(patientId) {
    const data = await request(`/patients/${patientId}/stats`);
    return data.stats;
  }

  // GET /api/doctors/:id/stats
  async function getDoctorStats(doctorId) {
    const data = await request(`/doctors/${doctorId}/stats`);
    return data.stats;
  }

  return {
    login,
    registerPatient,
    listDoctors,
    getDoctor,
    createDoctor,
    updateDoctor,
    setDoctorActive,
    listPatients,
    getPatient,
    updatePatient,
    listAppointments,
    createAppointment,
    updateAppointmentStatus,
    getAvailableSlots,
    getAdminStats,
    getPatientStats,
    getDoctorStats
  };
})();
