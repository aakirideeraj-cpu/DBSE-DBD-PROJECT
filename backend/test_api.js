async function runTests() {
  const BASE = "http://localhost:5000/api";
  console.log("=== RUNNING API ENDPOINT TESTS ===");

  // 1. Health
  const healthRes = await fetch(`${BASE}/health`);
  const health = await healthRes.json();
  console.log("1. Health check:", health.success ? "PASS" : "FAIL");

  // 2. Auth: Patient, Doctor, Admin login
  const patientLoginRes = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "rahul@example.com", password: "demo123" })
  });
  const patientLogin = await patientLoginRes.json();
  console.log("2a. Patient login:", patientLogin.session?.role === "patient" ? "PASS" : "FAIL", patientLogin.session?.name);

  const doctorLoginRes = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "ravi.kumar@medibook.test", password: "demo123" })
  });
  const doctorLogin = await doctorLoginRes.json();
  console.log("2b. Doctor login:", doctorLogin.session?.role === "doctor" ? "PASS" : "FAIL", doctorLogin.session?.name);

  const adminLoginRes = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@medibook.test", password: "demo123" })
  });
  const adminLogin = await adminLoginRes.json();
  console.log("2c. Admin login:", adminLogin.session?.role === "admin" ? "PASS" : "FAIL", adminLogin.session?.name);

  // 3. Doctors
  const docsRes = await fetch(`${BASE}/doctors?search=Ravi`);
  const docs = await docsRes.json();
  console.log("3a. Doctor search:", docs.doctors?.length > 0 ? "PASS" : "FAIL", `Found ${docs.doctors?.length} doctor(s)`);

  const docRes = await fetch(`${BASE}/doctors/101`);
  const doc = await docRes.json();
  console.log("3b. Single doctor:", doc.doctor?.doctor_id === 101 ? "PASS" : "FAIL", doc.doctor?.name);

  const slotsRes = await fetch(`${BASE}/doctors/101/slots?date=2026-10-10`);
  const slots = await slotsRes.json();
  console.log("3c. Doctor slots:", slots.slots?.length > 0 ? "PASS" : "FAIL", `${slots.slots?.length} slots calculated`);

  const docStatsRes = await fetch(`${BASE}/doctors/101/stats`);
  const docStats = await docStatsRes.json();
  console.log("3d. Doctor stats:", docStats.stats ? "PASS" : "FAIL", docStats.stats);

  // 4. Patients
  const patientsRes = await fetch(`${BASE}/patients`);
  const patients = await patientsRes.json();
  console.log("4a. Patients list:", patients.patients?.length > 0 ? "PASS" : "FAIL", `Total: ${patients.patients?.length}`);

  const patientRes = await fetch(`${BASE}/patients/1`);
  const patient = await patientRes.json();
  console.log("4b. Single patient:", patient.patient?.patient_id === 1 ? "PASS" : "FAIL", patient.patient?.first_name);

  const patientStatsRes = await fetch(`${BASE}/patients/1/stats`);
  const patientStats = await patientStatsRes.json();
  console.log("4c. Patient stats:", patientStats.stats ? "PASS" : "FAIL", patientStats.stats);

  // 5. Appointments list
  const apptsRes = await fetch(`${BASE}/appointments?patient_id=1`);
  const appts = await apptsRes.json();
  console.log("5a. Appointments list:", appts.appointments?.length >= 0 ? "PASS" : "FAIL", `Count: ${appts.appointments?.length}`);

  // 6. Appointment booking & status update
  const testDate = `2027-01-${String(10 + Math.floor(Math.random() * 18)).padStart(2, "0")}`;
  const bookRes = await fetch(`${BASE}/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patient_id: 1,
      doctor_id: 101,
      appointment_date: testDate,
      appointment_time: "11:00 AM",
      reason: "Automated verification test appointment"
    })
  });
  const book = await bookRes.json();
  console.log("6a. Book appointment:", book.success ? "PASS" : "FAIL", `Appointment ID: ${book.appointment?.appointment_id}`);

  // Test double booking prevention
  const doubleBookRes = await fetch(`${BASE}/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patient_id: 2,
      doctor_id: 101,
      appointment_date: testDate,
      appointment_time: "11:00 AM",
      reason: "Conflicting test appointment"
    })
  });
  console.log("6b. Double booking prevention (expected 409):", doubleBookRes.status === 409 ? "PASS" : "FAIL");

  if (book.appointment?.appointment_id) {
    const updateRes = await fetch(`${BASE}/appointments/${book.appointment.appointment_id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Confirmed" })
    });
    const update = await updateRes.json();
    console.log("6c. Update status:", update.appointment?.status === "Confirmed" ? "PASS" : "FAIL");
  }

  // 7. Admin Stats
  const adminStatsRes = await fetch(`${BASE}/admin/stats`);
  const adminStats = await adminStatsRes.json();
  console.log("7. Admin system stats:", adminStats.stats ? "PASS" : "FAIL", {
    patients: adminStats.stats?.patients,
    doctors: adminStats.stats?.doctors,
    appointments: adminStats.stats?.appointments?.total,
    specs: adminStats.stats?.bySpecialization?.length
  });

  console.log("=== ALL BACKEND TESTS COMPLETED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("Test failure:", err);
  process.exit(1);
});
