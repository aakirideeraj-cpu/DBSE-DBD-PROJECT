const mysql = require("mysql2/promise");
const path = require("path");

// Load .env from backend directory first, with fallback to root process.cwd()
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "appointment_db",
    port: Number(process.env.DB_PORT) || 3306,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true
});

async function testConnection() {
    try {
        const connection = await pool.getConnection();

        console.log("✅ MySQL database connected successfully!");

        connection.release();
    } catch (error) {
        console.error("❌ MySQL connection failed:", error.message);
    }
}

testConnection();

module.exports = pool;