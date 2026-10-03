/**
 * MediBook — API Gateway with Circuit Breaker Pattern
 * Port: 5000 (Central entry point for the frontend)
 *
 * Microservices Architecture Concepts Implemented:
 * 1. API GATEWAY PATTERN:
 *    - Unified reverse-proxy entrypoint for all clients.
 *    - Dynamic routing to domain-specific microservices:
 *        * /api/auth/*          → Auth Service (Port 5001)
 *        * /api/patients (POST) → Auth Service (Port 5001 - registration)
 *        * /api/*               → Appointment Service (Port 5002)
 *    - Distributed Request Tracing via 'x-request-id' correlation header.
 *    - Latency measurement and structured proxy logging.
 *
 * 2. CIRCUIT BREAKER PATTERN (Fault Tolerance & Resilience):
 *    - Protects the system against cascading failures when an upstream microservice fails.
 *    - Finite State Machine:
 *        * CLOSED    → Normal operation. Requests pass through to upstream service.
 *        * OPEN      → Service failed repeated checks. Requests fail-fast immediately (HTTP 503).
 *        * HALF-OPEN → Canary probe request is sent to check if upstream service recovered.
 *    - Exposes live circuit breaker telemetry and interactive trip/reset endpoints at:
 *        * GET  /services/circuit-breakers
 *        * POST /services/circuit-breakers/:service/trip
 *        * POST /services/circuit-breakers/:service/reset
 *        * GET  /services/health
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();
app.use(cors());
app.use(express.json());

const AUTH_URL        = process.env.AUTH_SERVICE_URL        || "http://localhost:5001";
const APPOINTMENT_URL = process.env.APPOINTMENT_SERVICE_URL || "http://localhost:5002";

// ============================================================================
// MICROSERVICES CONCEPT: CIRCUIT BREAKER PATTERN
// ============================================================================
class CircuitBreaker {
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.failureThreshold = options.failureThreshold || 3; // Trip after 3 consecutive errors
    this.resetTimeout = options.resetTimeout || 10000;     // 10-second cooldown before probe
    this.failureCount = 0;
    this.successCount = 0;
    this.totalRequests = 0;
    this.state = "CLOSED"; // CLOSED | OPEN | HALF-OPEN
    this.lastFailureTime = null;
    this.lastStateChange = Date.now();
  }

  isOpen() {
    if (this.state === "OPEN") {
      const now = Date.now();
      if (now - this.lastFailureTime > this.resetTimeout) {
        this.state = "HALF-OPEN";
        this.lastStateChange = now;
        console.log(`⚡ [CircuitBreaker:${this.serviceName}] Cooldown expired. State -> HALF-OPEN (Testing probe canary)`);
        return false; // Allow probe request through
      }
      return true; // Still tripped
    }
    return false;
  }

  getRemainingCooldown() {
    if (this.state !== "OPEN" || !this.lastFailureTime) return 0;
    const remaining = this.resetTimeout - (Date.now() - this.lastFailureTime);
    return remaining > 0 ? remaining : 0;
  }

  recordSuccess() {
    this.totalRequests++;
    this.failureCount = 0;
    this.successCount++;
    if (this.state === "HALF-OPEN") {
      this.state = "CLOSED";
      this.lastStateChange = Date.now();
      console.log(`✅ [CircuitBreaker:${this.serviceName}] Canary probe succeeded! State -> CLOSED (Service recovered)`);
    }
  }

  recordFailure(error) {
    this.totalRequests++;
    this.failureCount++;
    this.lastFailureTime = Date.now();
    const errMsg = error ? error.message : "Upstream error";
    console.warn(`⚠️ [CircuitBreaker:${this.serviceName}] Failure #${this.failureCount} recorded: ${errMsg}`);

    if (this.state === "CLOSED" && this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
      this.lastStateChange = Date.now();
      console.error(`🚨 [CircuitBreaker:${this.serviceName}] THRESHOLD REACHED (${this.failureThreshold}). Breaker tripped -> OPEN!`);
    } else if (this.state === "HALF-OPEN") {
      this.state = "OPEN";
      this.lastStateChange = Date.now();
      console.error(`🚨 [CircuitBreaker:${this.serviceName}] Canary probe failed! State reverted -> OPEN.`);
    }
  }

  trip() {
    this.state = "OPEN";
    this.failureCount = this.failureThreshold;
    this.lastFailureTime = Date.now();
    this.lastStateChange = Date.now();
    console.log(`🔧 [CircuitBreaker:${this.serviceName}] Manually tripped -> OPEN`);
  }

  reset() {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.lastStateChange = Date.now();
    console.log(`🔧 [CircuitBreaker:${this.serviceName}] Manually reset -> CLOSED`);
  }

  getStatus() {
    return {
      service: this.serviceName,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      failureThreshold: this.failureThreshold,
      resetTimeoutMs: this.resetTimeout,
      remainingCooldownMs: this.getRemainingCooldown(),
      lastFailure: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
      lastStateChange: new Date(this.lastStateChange).toISOString()
    };
  }
}

// Instantiate dedicated Circuit Breakers for each downstream microservice
const authBreaker        = new CircuitBreaker("Auth Service", { failureThreshold: 3, resetTimeout: 10000 });
const appointmentBreaker = new CircuitBreaker("Appointment Service", { failureThreshold: 3, resetTimeout: 10000 });

// ============================================================================
// MICROSERVICES CONCEPT: API GATEWAY PROXY DISPATCHER
// ============================================================================
function proxyRequest(targetBaseUrl, breaker, req, res) {
  return new Promise((resolve) => {
    // 1. Generate or forward correlation ID for distributed tracing
    const requestId = req.headers["x-request-id"] || `req-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    res.setHeader("x-request-id", requestId);

    const startTime = Date.now();

    // 2. Check Circuit Breaker state before making network call
    if (breaker.isOpen()) {
      const cooldownSec = Math.ceil(breaker.getRemainingCooldown() / 1000);
      console.warn(`🛑 [Gateway] [${requestId}] Fast-fail: Circuit Breaker for ${breaker.serviceName} is OPEN. Blocking request.`);
      return res.status(503).json({
        success: false,
        circuitBreaker: "OPEN",
        service: breaker.serviceName,
        message: `${breaker.serviceName} is currently unavailable. Circuit breaker is OPEN to prevent cascading failure.`,
        retryAfterSeconds: cooldownSec,
        requestId
      });
    }

    // 3. Construct target URL (strip /api prefix when forwarding to microservice)
    const targetPath = req.originalUrl.replace(/^\/api/, "") || "/";
    const url = new URL(targetBaseUrl);

    const cleanHeaders = { ...req.headers };
    delete cleanHeaders["host"];
    delete cleanHeaders["content-length"]; // Recomputed below for body accuracy

    const options = {
      hostname: url.hostname,
      port:     url.port || 80,
      path:     targetPath,
      method:   req.method,
      headers: {
        ...cleanHeaders,
        host: `${url.hostname}:${url.port || 80}`,
        "x-request-id": requestId,
        "x-forwarded-by": "MediBook-API-Gateway"
      }
    };

    let bodyData = null;
    if (req.body && Object.keys(req.body).length > 0) {
      bodyData = JSON.stringify(req.body);
      options.headers["content-type"] = "application/json";
      options.headers["content-length"] = Buffer.byteLength(bodyData);
    }

    const proxyReq = http.request(options, (proxyRes) => {
      const durationMs = Date.now() - startTime;
      console.log(`📡 [Gateway] [${requestId}] ${req.method} ${targetPath} -> ${breaker.serviceName} (${proxyRes.statusCode}) in ${durationMs}ms`);

      // Track circuit breaker metrics based on upstream status
      if (proxyRes.statusCode >= 500) {
        breaker.recordFailure(new Error(`Upstream returned HTTP ${proxyRes.statusCode}`));
      } else {
        breaker.recordSuccess();
      }

      res.status(proxyRes.statusCode);
      Object.entries(proxyRes.headers).forEach(([k, v]) => res.setHeader(k, v));
      proxyRes.pipe(res, { end: true });
      resolve();
    });

    proxyReq.on("error", (err) => {
      const durationMs = Date.now() - startTime;
      console.error(`💥 [Gateway] [${requestId}] Network error contacting ${breaker.serviceName} (${durationMs}ms):`, err.message);
      breaker.recordFailure(err);

      if (!res.headersSent) {
        res.status(502).json({
          success: false,
          circuitBreaker: breaker.state,
          service: breaker.serviceName,
          message: `Gateway Error: Upstream ${breaker.serviceName} is unreachable. (${err.message})`,
          requestId
        });
      }
      resolve();
    });

    // Send payload if present
    if (bodyData) {
      proxyReq.write(bodyData);
    }
    proxyReq.end();
  });
}

// ============================================================================
// GATEWAY & MICROSERVICES TELEMETRY ENDPOINTS
// ============================================================================

// Gateway Health
app.get("/health", (req, res) => {
  res.json({
    service: "API Gateway",
    status: "running",
    port: process.env.PORT || 5000,
    timestamp: new Date().toISOString(),
    architecture: "Microservices",
    concepts: [
      "API Gateway Pattern (Centralized reverse proxy, routing & tracing)",
      "Circuit Breaker Pattern (Fault tolerance, fail-fast & automatic recovery)",
      "Stateless Tokenization (JWT Bearer Token delegation)"
    ],
    upstreamServices: {
      authService: AUTH_URL,
      appointmentService: APPOINTMENT_URL
    }
  });
});

// Circuit Breakers Status Endpoint
app.get("/services/circuit-breakers", (req, res) => {
  res.json({
    success: true,
    circuitBreakers: {
      authService: authBreaker.getStatus(),
      appointmentService: appointmentBreaker.getStatus()
    },
    timestamp: new Date().toISOString()
  });
});

// Interactive Circuit Breaker Trip Endpoint (for demo testing)
app.post("/services/circuit-breakers/:service/trip", (req, res) => {
  const service = req.params.service.toLowerCase();
  let targetBreaker = null;
  if (service.includes("auth")) targetBreaker = authBreaker;
  if (service.includes("appointment") || service.includes("appt")) targetBreaker = appointmentBreaker;

  if (!targetBreaker) {
    return res.status(404).json({ success: false, message: `Unknown service: ${req.params.service}. Use 'auth' or 'appointment'.` });
  }

  targetBreaker.trip();
  res.json({
    success: true,
    message: `Circuit Breaker for ${targetBreaker.serviceName} was manually TRIPPED to OPEN state for testing.`,
    status: targetBreaker.getStatus()
  });
});

// Interactive Circuit Breaker Reset Endpoint
app.post("/services/circuit-breakers/:service/reset", (req, res) => {
  const service = req.params.service.toLowerCase();
  let targetBreaker = null;
  if (service.includes("auth")) targetBreaker = authBreaker;
  if (service.includes("appointment") || service.includes("appt")) targetBreaker = appointmentBreaker;

  if (!targetBreaker) {
    return res.status(404).json({ success: false, message: `Unknown service: ${req.params.service}. Use 'auth' or 'appointment'.` });
  }

  targetBreaker.reset();
  res.json({
    success: true,
    message: `Circuit Breaker for ${targetBreaker.serviceName} was reset to CLOSED.`,
    status: targetBreaker.getStatus()
  });
});

// Aggregate Health — queries all downstream microservices
app.get("/services/health", async (req, res) => {
  async function checkService(url, name, breaker) {
    const start = Date.now();
    try {
      const result = await new Promise((resolve, reject) => {
        const u = new URL(url + "/health");
        const options = { hostname: u.hostname, port: u.port, path: u.pathname, method: "GET", timeout: 2500 };
        const r = http.request(options, (resp) => {
          let data = "";
          resp.on("data", (chunk) => data += chunk);
          resp.on("end", () => {
            try { resolve(JSON.parse(data)); }
            catch { resolve({ status: "running" }); }
          });
        });
        r.on("error", () => reject(new Error("unreachable")));
        r.on("timeout", () => { r.destroy(); reject(new Error("timeout")); });
        r.end();
      });
      return {
        name,
        status: "running",
        latencyMs: Date.now() - start,
        circuitBreaker: breaker.state,
        details: result
      };
    } catch (e) {
      return {
        name,
        status: "unreachable",
        latencyMs: Date.now() - start,
        circuitBreaker: breaker.state,
        error: e.message
      };
    }
  }

  const [authStatus, apptStatus] = await Promise.all([
    checkService(AUTH_URL, "Auth Service", authBreaker),
    checkService(APPOINTMENT_URL, "Appointment Service", appointmentBreaker)
  ]);

  const allHealthy = authStatus.status === "running" && apptStatus.status === "running";

  res.json({
    success: true,
    systemStatus: allHealthy ? "HEALTHY" : "DEGRADED",
    gateway: {
      name: "API Gateway",
      port: process.env.PORT || 5000,
      status: "running"
    },
    services: [authStatus, apptStatus],
    circuitBreakers: {
      authService: authBreaker.getStatus(),
      appointmentService: appointmentBreaker.getStatus()
    },
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// GATEWAY DYNAMIC ROUTING RULES
// ============================================================================

// 1. Auth routes → Auth Service (Port 5001)
app.all("/api/auth/*", (req, res) => proxyRequest(AUTH_URL, authBreaker, req, res));

// 2. Patient registration → Auth Service (generates JWT token on register)
app.post("/api/patients", (req, res) => proxyRequest(AUTH_URL, authBreaker, req, res));

// 3. All other /api/* routes → Appointment Service (Port 5002)
app.all("/api/*", (req, res) => proxyRequest(APPOINTMENT_URL, appointmentBreaker, req, res));

// ============================================================================
// SERVE FRONTEND (STATIC ASSETS & SPA ROUTING)
// ============================================================================
app.use(express.static(path.join(__dirname, "../../frontend")));

// SPA fallback — serve index.html for all non-API paths
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/index.html"));
});

// ============================================================================
// START GATEWAY
// ============================================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("=================================================================");
  console.log(`🌐 MediBook API Gateway running at http://localhost:${PORT}`);
  console.log(`   [Microservices Concept 1] API Gateway & Tracing active on port ${PORT}`);
  console.log(`   [Microservices Concept 2] Circuit Breakers: Auth & Appointment Active`);
  console.log(`   - Auth Service:        ${AUTH_URL}`);
  console.log(`   - Appointment Service: ${APPOINTMENT_URL}`);
  console.log(`   - Gateway Health:      http://localhost:${PORT}/health`);
  console.log(`   - System Health:       http://localhost:${PORT}/services/health`);
  console.log(`   - Circuit Breakers:    http://localhost:${PORT}/services/circuit-breakers`);
  console.log("=================================================================");
});
