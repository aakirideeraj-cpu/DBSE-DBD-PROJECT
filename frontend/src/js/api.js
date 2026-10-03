/* ==========================================================================
   MediBook — api.js
   THE ONLY FILE THAT TOUCHES DATA.

   Fully integrated with the Node.js/Express + MySQL backend!
   Every function makes real HTTP requests via fetch() to the Express REST API.

   JWT Authentication:
   - On login/register, a JWT token is returned and stored in sessionStorage.
   - Every subsequent request includes: Authorization: Bearer <token>
   - On 401 (expired/invalid), the user is automatically logged out.
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

  // ========================================================================
  // TOKEN STORAGE — sessionStorage keeps token for this browser tab session.
  // Using sessionStorage (not localStorage) so the token clears when the
  // browser tab is closed, which is appropriate for a healthcare demo app.
  // ========================================================================
  const TOKEN_KEY = 'medibook_jwt_token';

  function saveToken(token) {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
  }

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
  }

  // ========================================================================
  // HTTP REQUEST HELPER
  // Automatically attaches Authorization: Bearer <token> header when a token
  // is stored. Handles 401 (expired) by logging the user out gracefully.
  // ========================================================================
  async function request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;

    const token = getToken();
    const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...(options.headers || {})
      },
      ...options
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      // 401 = expired or missing token → auto-logout
      if (response.status === 401) {
        clearToken();
        // Notify the app to log the user out
        if (typeof App !== 'undefined' && App.handleAuthFailure) {
          App.handleAuthFailure(data.message || 'Session expired. Please log in again.');
        }
        throw new Error(data.message || 'Session expired. Please log in again.');
      }

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
  // Returns session object. Token is stored internally.
  async function login(email, password) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    // Save JWT token returned by Auth Service
    if (data.token) saveToken(data.token);
    return data.session;
  }

  // POST /api/patients (registration via Auth Service → returns JWT)
  async function registerPatient(form) {
    const data = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(form)
    });
    // Save JWT token
    if (data.token) saveToken(data.token);
    return data.session;
  }

  // Logout — clear the stored token
  function logout() {
    clearToken();
  }

  // Decode JWT payload (stateless client-side claim inspection)
  function decodeToken(token) {
    const raw = token || getToken();
    if (!raw) return null;
    try {
      const parts = raw.split('.');
      if (parts.length !== 3) return null;
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.warn('Unable to decode JWT token:', e);
      return null;
    }
  }

  // GET /api/auth/verify — verifies token with Auth Service
  async function verifyToken() {
    const token = getToken();
    if (!token) return null;
    try {
      const data = await request('/auth/verify', { method: 'GET' });
      return data.user || null;
    } catch (e) {
      clearToken();
      return null;
    }
  }

  /* ======================================================================
     MICROSERVICES TELEMETRY & CIRCUIT BREAKER
     ====================================================================== */
  async function getMicroservicesHealth() {
    try {
      const origin = BASE_URL.replace(/\/api$/, '');
      const resp = await fetch(`${origin}/services/health`);
      return await resp.json();
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async function getCircuitBreakers() {
    try {
      const origin = BASE_URL.replace(/\/api$/, '');
      const resp = await fetch(`${origin}/services/circuit-breakers`);
      return await resp.json();
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async function tripCircuitBreaker(service) {
    try {
      const origin = BASE_URL.replace(/\/api$/, '');
      const resp = await fetch(`${origin}/services/circuit-breakers/${service}/trip`, { method: 'POST' });
      return await resp.json();
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async function resetCircuitBreaker(service) {
    try {
      const origin = BASE_URL.replace(/\/api$/, '');
      const resp = await fetch(`${origin}/services/circuit-breakers/${service}/reset`, { method: 'POST' });
      return await resp.json();
    } catch (e) {
      return { success: false, error: e.message };
    }
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
    logout,
    registerPatient,
    saveToken,
    getToken,
    clearToken,
    decodeToken,
    verifyToken,
    getMicroservicesHealth,
    getCircuitBreakers,
    tripCircuitBreaker,
    resetCircuitBreaker,
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
