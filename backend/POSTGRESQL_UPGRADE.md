# PostgreSQL 9.3 → 16 Upgrade Required

## Problem
PostgreSQL 9.3 does NOT support JSONB type (introduced in 9.4).
Project migrations require JSONB for modern data types.

## Solution: Upgrade PostgreSQL to 16

### Step 1: Download PostgreSQL 16
Visit: https://www.postgresql.org/download/windows/
- Choose PostgreSQL 16 (latest stable version)
- Download the installer for Windows (64-bit recommended)

### Step 2: Install PostgreSQL 16
1. Run the installer
2. **IMPORTANT**: Use port **5433** (not 5432) to avoid conflict with PostgreSQL 9.3
3. Set a password (e.g., `postgres` or `gapak`)
4. Remember the password and port number

### Step 3: Create Database in PostgreSQL 16
```powershell
# Connect to new PostgreSQL 16 instance (port 5433)
$env:PGPASSWORD='your_password'
& 'C:\Program Files\PostgreSQL\16\bin\psql.exe' -U postgres -h 127.0.0.1 -p 5433 -c "CREATE DATABASE gapak;"
```

### Step 4: Update .env for PostgreSQL 16
```env
DATABASE_URL=postgresql://postgres:your_password@127.0.0.1:5433/gapak?sslmode=disable
```

### Step 5: Run Migrations
```powershell
cd "D:\GO-Lessons\pro-go\Gapak\backend"
go run ./cmd/migrate
```

### Step 6: Start API Server
```powershell
go run ./cmd/api
```

---

## Alternative: Use Docker (Recommended)
Docker includes all services pre-configured. Much simpler:
```powershell
cd "D:\GO-Lessons\pro-go\Gapak\backend"
docker-compose up --build
```

---

## Why PostgreSQL 9.3 Won't Work
- Released: 2013 (end-of-life: 2018)
- Missing features:
  - JSONB type (needed for modern apps)
  - Many performance improvements
  - Security updates
- Project requires PostgreSQL 9.4 minimum, 16 recommended

---

**Choose one:**
1. ✅ Upgrade PostgreSQL to 16 → More work, full local control
2. ✅ Use Docker → Simple, all services included, recommended
