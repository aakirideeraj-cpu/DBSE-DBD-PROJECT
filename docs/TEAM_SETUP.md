# MediBook — Teammate Setup Guide for Windows

Welcome to the **MediBook** project! This guide walks you step-by-step through setting up and running the MediBook Doctor Appointment Booking System on a Windows PC from scratch.

---

## 📋 Prerequisites Checklist

Before you begin, ensure you have administrator access on your Windows machine. You will need:
- **Node.js** (v18.x or v20.x LTS)
- **MySQL Community Server** (v8.0 or higher)
- **MySQL Workbench** (v8.0 or higher)
- **Git for Windows** (or GitHub Desktop)

---

## 🛠️ Step-by-Step Installation Guide

### STEP 1 — Install Node.js

1. Visit [nodejs.org](https://nodejs.org/) and download the **LTS (Long Term Support)** installer for Windows (`.msi`).
2. Run the installer and click through the setup wizard (accept the default options).
3. Open **PowerShell** or **Command Prompt** and verify the installation:
   ```powershell
   node -v
   npm -v
   ```
   *Expected output:* Node version `v18.x.x` (or `v20.x.x`) and npm version `9.x.x` (or `10.x.x`).

---

### STEP 2 — Install MySQL Server and MySQL Workbench

1. Visit [dev.mysql.com/downloads/installer/](https://dev.mysql.com/downloads/installer/) and download **MySQL Installer for Windows** (choose the full installer, ~300-400 MB).
2. Run the installer:
   - Select **Custom** or **Developer Default**.
   - Ensure both **MySQL Server 8.0** and **MySQL Workbench 8.0** are checked for installation.
3. During Configuration:
   - Port: leave at default `3306`.
   - Authentication: choose **Use Strong Password Encryption (RECOMMENDED)** or Standard.
   - **Root Account Password:** Set a password for the `root` user (e.g., `root`, `admin123`, or your chosen password). **Remember this password!** You will need it in Step 6.
   - Windows Service: Ensure **Start the MySQL Server at System Startup** is checked.
4. Finish installation and open **MySQL Workbench**. Click on **Local instance MySQL80** to test your connection using your root password.

---

### STEP 3 — Clone the GitHub Repository

Open **PowerShell** or **Terminal** and navigate to your preferred working directory (e.g., `C:\Projects`):

```powershell
cd C:\Projects
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd DBSE-DBD-PROJECT
```

*(Replace `<YOUR_GITHUB_REPOSITORY_URL>` with your team's GitHub repository link).*

---

### STEP 4 — Create the Database Using `setup-database.sql`

We have provided a complete setup script at `database/setup-database.sql`. You can run it either using **MySQL Workbench** (recommended) or via the **Command Line**.

#### Option A: Using MySQL Workbench (Visual & Recommended)
1. Open **MySQL Workbench** and connect to your local MySQL instance (`root@localhost:3306`).
2. Go to **File** → **Open SQL Script...** (or press `Ctrl + O`).
3. Browse to the cloned repository and open:
   `database/setup-database.sql`
4. Click the **Execute (Lightning Bolt ⚡)** icon on the toolbar to run the entire script.
5. In the bottom **Action Output** pane, check that all statements executed with green checkmarks.
6. In the left **Navigator** pane, right-click and click **Refresh All**. You will now see `appointment_db` with all tables (`admins`, `doctors`, `patients`, `appointments`), views, and stored procedures.

#### Option B: Using Command Prompt / PowerShell
Run the following command from the root of the project:
```powershell
mysql -u root -p < database/setup-database.sql
```
*Enter your MySQL root password when prompted.*

---

### STEP 5 — Copy `.env.example` to `.env`

The repository includes a template file `backend/.env.example`. Create your local `.env` file by copying it:

In **PowerShell**:
```powershell
cd backend
Copy-Item .env.example .env
```
*(Or in Command Prompt: `copy .env.example .env`)*

> ⚠️ **Note:** `.env` is deliberately listed in `.gitignore` so your personal database password will never be accidentally committed to GitHub.

---

### STEP 6 — Enter Your Own MySQL Password

Open `backend/.env` in VS Code or Notepad:

```env
# MySQL Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=YOUR_ACTUAL_MYSQL_PASSWORD_HERE
DB_NAME=appointment_db
DB_PORT=3306

# Backend Server Configuration
PORT=5000
```

1. Replace `YOUR_ACTUAL_MYSQL_PASSWORD_HERE` with the password you set for the MySQL `root` user in **Step 2**.
2. Save the file (`Ctrl + S`).

---

### STEP 7 — Install Backend Dependencies

From the `backend` directory, install all required Node.js packages:

```powershell
cd C:\Projects\DBSE-DBD-PROJECT\backend
npm install
```

This installs:
- `express` (REST API web framework)
- `mysql2` (high-performance MySQL connection pool with Promises)
- `cors` (Cross-Origin Resource Sharing middleware)
- `dotenv` (environment variable manager)

---

### STEP 8 — Start the Backend Server

Run the backend server using Node.js:

```powershell
node server.js
```

You should see:
```text
✅ MySQL database connected successfully!
🚀 MediBook server running on http://localhost:5000
```

Keep this terminal window open! The backend must remain running while using the app.

---

### STEP 9 — Open the Frontend Application

You can access MediBook in any of the following 3 ways:

- **Method 1: Unified Server (Recommended)**
  Open your web browser (Chrome, Edge, Firefox) and navigate to:
  👉 **`http://localhost:5000`**
  *(Express automatically serves the frontend directly from this URL).*

- **Method 2: VS Code Live Server**
  Open the project in VS Code, right-click `frontend/index.html` → **Open with Live Server** (`http://127.0.0.1:5500`). The frontend will automatically connect to your backend on port 5000.

- **Method 3: Direct File**
  Double-click `frontend/index.html` to open it in your browser.

---

### STEP 10 — Test the Application

1. **Verify Automated API Suite:**
   Open a second PowerShell window, navigate to `backend`, and run:
   ```powershell
   npm test
   ```
   All checks (Health, Auth, Doctors, Patients, Appointments, Double-Booking, Admin Stats) should display `PASS`.

2. **Test Demo Logins via Web UI:**
   On the login screen, click the quick demo buttons to log in as each role:

   | Role | Demo Email | Password | What to Verify |
   |---|---|---|---|
   | **Patient** | `rahul@example.com` | `demo123` | View dashboard, filter doctors, book a slot |
   | **Doctor** | `ravi.kumar@medibook.test` | `demo123` | View schedule, accept/reject booking requests |
   | **Admin** | `admin@medibook.test` | `demo123` | Doctor directory, audit appointments, view analytics |

---

## 🔧 Troubleshooting Guide

### 1. MySQL Connection Failure (`ECONNREFUSED 127.0.0.1:3306`)
- **Cause:** The MySQL Windows Service is stopped or not running.
- **Fix:**
  1. Press `Win + R`, type `services.msc`, and press Enter.
  2. Scroll down to find **MySQL80** (or **MySQL**).
  3. Right-click it and click **Start** (or **Restart**).
  4. Alternatively in PowerShell (as Administrator):
     ```powershell
     Start-Service MySQL80
     ```

### 2. Wrong Password (`ER_ACCESS_DENIED_ERROR` for user 'root'@'localhost')
- **Cause:** The password specified in `backend/.env` does not match your MySQL root password.
- **Fix:**
  1. Test your password in MySQL Workbench by opening the local connection.
  2. Once verified, open `backend/.env` and update `DB_PASSWORD=your_exact_password`.
  3. Save the file and restart `node server.js`.

### 3. Port 5000 Already in Use (`EADDRINUSE: address already in use :::5000`)
- **Cause:** Another process or previous node instance is already running on port 5000.
- **Fix:**
  1. In PowerShell, find the process ID (PID) holding port 5000:
     ```powershell
     Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess
     ```
  2. Stop that process:
     ```powershell
     Stop-Process -Id <PID> -Force
     ```
  3. Or change `PORT=5001` in `backend/.env` and re-run.

### 4. Database Does Not Exist (`ER_BAD_DB_ERROR: Unknown database 'appointment_db'`)
- **Cause:** Step 4 was skipped or failed.
- **Fix:**
  1. Open MySQL Workbench.
  2. Open and execute `database/setup-database.sql`.
  3. Refresh the schemas list to confirm `appointment_db` exists.

### 5. Missing npm Packages (`Error: Cannot find module 'express'` / `mysql2` / etc.)
- **Cause:** `npm install` was run in the root directory instead of `backend`, or failed.
- **Fix:**
  ```powershell
  cd backend
  npm install
  ```

### 6. CORS Problems (Blocked by CORS policy)
- **Cause:** Frontend opened on an unusual port and backend CORS is rejecting it.
- **Fix:**
  1. MediBook's Express backend has `app.use(cors())` enabled by default to allow cross-origin requests from `localhost` / `127.0.0.1`.
  2. Use **Method 1** (`http://localhost:5000`), which serves frontend and API from the same origin, eliminating all CORS issues entirely.

---

## 📞 Need Help?

If you encounter any issues not covered in this guide, check with the project lead or submit an issue on the GitHub repository with the exact error message from your terminal console.
