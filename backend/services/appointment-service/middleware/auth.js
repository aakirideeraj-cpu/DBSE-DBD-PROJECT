/**
 * MediBook — JWT Auth Middleware
 * Shared by appointment-service (and could be used in future services).
 *
 * Usage:
 *   const { requireAuth, requireRole } = require('./middleware/auth');
 *
 *   router.get('/appointments', requireAuth, requireRole('patient'), handler);
 */

const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * requireAuth — validates the Bearer JWT in Authorization header.
 * On success: attaches req.user = { id, role, email, name }
 * On failure: returns 401 or 403
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please log in to access this resource."
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, role, email, name, iat, exp }
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Your session has expired. Please log in again.",
        expired: true
      });
    }
    return res.status(403).json({
      success: false,
      message: "Invalid authentication token."
    });
  }
}

/**
 * requireRole — role-based authorization.
 * Must be used AFTER requireAuth so req.user is already populated.
 *
 * @param {...string} roles - accepted roles e.g. "admin", "doctor", "patient"
 *
 * Usage:
 *   requireRole("admin")
 *   requireRole("doctor", "admin")   // either role is acceptable
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(" or ")}. Your role: ${req.user.role}.`
      });
    }

    next();
  };
}

module.exports = { requireAuth, requireRole };
