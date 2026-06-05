# PostgreSQL 9.3 → 16 Upgrade Required (or use Cloud Database)

## Problem
PostgreSQL 9.3 does NOT support JSONB type (introduced in 9.4).
Project migrations require JSONB for modern data types.

## Solution Options

### Option 1: Use Cloud PostgreSQL (Recommended - Current Setup)

The project is now configured to use **Prisma Data Proxy** (Cloud PostgreSQL):

```env
DATABASE_URL=postgres://user:password@db.example.com:5432/postgres?sslmode=require
```

**Advantages:**
- ✅ No local PostgreSQL installation needed
- ✅ Automatic backups and maintenance
- ✅ SSL/TLS encryption enabled
- ✅ Works from anywhere (cloud connection)

**To use this setup:**
1. Ensure your `.env` has the cloud DATABASE_URL set
2. Run migrations: `go run ./cmd/migrate`
3. Start API: `go run ./cmd/api`

---

### Option 2: Upgrade PostgreSQL to 16 (Local Setup)

#### Step 1: Download PostgreSQL 16
Visit: https://www.postgresql.org/download/windows/
- Choose PostgreSQL 16 (latest stable version)
- Download the installer for Windows (64-bit recommended)

#### Step 2: Install PostgreSQL 16
1. Run the installer
2. Use port **5432** (default PostgreSQL port)
3. Set password (e.g., `postgres` or `gapak`)
4. Remember the password and port number

#### Step 3: Create Database in PostgreSQL 16
```powershell
# Connect to new PostgreSQL 16 instance (port 5432)
$env:PGPASSWORD='your_password'
& 'C:\Program Files\PostgreSQL\16\bin\psql.exe' -U postgres -h 127.0.0.1 -p 5432 -c "CREATE DATABASE gapak;"
```

#### Step 4: Update .env for PostgreSQL 16 (Local)
```env
# Local PostgreSQL 16
DATABASE_URL=postgresql://postgres:your_password@127.0.0.1:5432/gapak?sslmode=disable
```

#### Step 5: Run Migrations
```powershell
cd "D:\GO-Lessons\pro-go\Gapak\backend"
go run ./cmd/migrate
```

#### Step 6: Start API Server
```powershell
go run ./cmd/api
```

---

## Alternative: Use Docker (Recommended for Local Dev)

Docker includes all services pre-configured:

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
1. ✅ **Cloud PostgreSQL** (Current) → Already configured, just run migrations
2. ✅ **Upgrade PostgreSQL to 16** → Local control, full setup needed
3. ✅ **Use Docker** → All services included, recommended for local dev
