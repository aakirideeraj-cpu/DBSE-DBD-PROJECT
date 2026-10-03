/**
 * MediBook — Microservices Orchestrator Runner
 * 
 * Boots all microservices concurrently in separate child processes:
 *  1. Auth Microservice        (Port 5001) - Authentication, Patient Registration, JWT Tokenization
 *  2. Appointment Microservice (Port 5002) - Doctors, Patients, Appointments, Clinical Records
 *  3. API Gateway              (Port 5000) - Reverse Proxy, Routing, Distributed Tracing & Circuit Breaker
 *
 * Usage:
 *   node start-services.js
 *   npm run services
 */

const { spawn } = require("child_process");
const path = require("path");

const services = [
  {
    name: "Auth Service",
    port: 5001,
    color: "\x1b[36m", // Cyan
    script: path.join(__dirname, "services", "auth-service", "server.js"),
    cwd: path.join(__dirname, "services", "auth-service")
  },
  {
    name: "Appointment Service",
    port: 5002,
    color: "\x1b[32m", // Green
    script: path.join(__dirname, "services", "appointment-service", "server.js"),
    cwd: path.join(__dirname, "services", "appointment-service")
  },
  {
    name: "API Gateway",
    port: 5000,
    color: "\x1b[35m", // Magenta
    script: path.join(__dirname, "gateway", "server.js"),
    cwd: path.join(__dirname, "gateway")
  }
];

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

console.log(`${BOLD}=================================================================${RESET}`);
console.log(`${BOLD}🚀  Starting MediBook Microservices Architecture...${RESET}`);
console.log(`   [1] API Gateway Pattern        -> http://localhost:5000`);
console.log(`   [2] Circuit Breaker & Fallback -> Active in Gateway`);
console.log(`   [3] JWT Token-Based Auth       -> Port 5001 (Auth Service)`);
console.log(`   [4] Appointment Microservice   -> Port 5002`);
console.log(`${BOLD}=================================================================${RESET}\n`);

const runningProcesses = [];

function startService(svc) {
  const child = spawn(process.execPath, [svc.script], {
    cwd: svc.cwd,
    env: { ...process.env },
    stdio: ["pipe", "pipe", "pipe"]
  });

  const prefix = `${svc.color}[${svc.name}]${RESET}`;

  child.stdout.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    lines.forEach((line) => {
      if (line.trim()) console.log(`${prefix} ${line.trim()}`);
    });
  });

  child.stderr.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    lines.forEach((line) => {
      if (line.trim()) console.error(`${prefix} \x1b[31m${line.trim()}${RESET}`);
    });
  });

  child.on("close", (code) => {
    console.log(`${prefix} Process exited with code ${code}`);
  });

  runningProcesses.push(child);
}

// Start services
services.forEach((svc) => startService(svc));

// Graceful shutdown on Ctrl+C
process.on("SIGINT", () => {
  console.log(`\n${BOLD}Shutting down all MediBook microservices...${RESET}`);
  runningProcesses.forEach((child) => child.kill("SIGINT"));
  setTimeout(() => process.exit(0), 1000);
});

process.on("SIGTERM", () => {
  runningProcesses.forEach((child) => child.kill("SIGTERM"));
  process.exit(0);
});
