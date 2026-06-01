# Gapak Backend - Complete Setup Guide

## Quick Summary of Issues Found & Fixed

### ✅ Fixed Issues
1. **Database Connection Error (SQLSTATE 28P01)** - Authentication failed
   - **Root Cause**: `.env` file used `postgresql://postgres@127.0.0.1:5432/gapak` (wrong user)
   - **Fix**: Changed to `postgresql://gapak:gapak@127.0.0.1:5432/gapak` to match docker-compose credentials
   
2. **Configuration Validation Errors**
   - **JWT Secrets**: Were too short (< 32 chars) ✅ Fixed
   - **PASSWORD_PEPPER**: Was too short (< 16 chars) ✅ Fixed
   - **STORAGE_SIGNING_SECRET**: Was truncated ✅ Fixed
   - **ANONYMITY_HASH_SECRET**: Was truncated ✅ Fixed
   - **Duplicate STORAGE_SIGNING_SECRET**: Removed duplicate entries ✅ Fixed

## Prerequisites

This project requires the following services to run:

### Required
- **PostgreSQL 16** (for data storage)
- **Redis 7** (for caching and realtime events)
- **MinIO** (for S3-compatible object storage)
- **Docker & Docker Compose** (recommended way to run these services)
- **Go 1.24+** (currently have 1.26.2 ✅)

### Current System Status
| Component | Status | Version |
|-----------|--------|---------|
| Go | ✅ Available | 1.26.2 |
| PostgreSQL | ❌ Not properly configured | 9.3 (old, incompatible) |
| Docker | ❌ Not installed | - |
| Redis | ❌ Not installed | - |
| MinIO | ❌ Not installed | - |

## Installation Steps

### Step 1: Install Docker Desktop for Windows

Docker Desktop provides Docker, Docker Compose, and other essential tools.

1. Download Docker Desktop: https://www.docker.com/products/docker-desktop/
2. Run the installer and follow the installation wizard
3. Restart your computer when installation completes
4. Verify installation:
   ```powershell
   docker --version
   docker-compose --version
   ```

### Step 2: Configure Environment Variables

The `.env` file has been updated with correct values. Verify it contains:

**Critical Variables to Check:**
```
# Database (MUST match docker-compose credentials)
DATABASE_URL=postgresql://gapak:gapak@127.0.0.1:5432/gapak?sslmode=disable

# Secrets (ALL must be present and at least minimum length)
JWT_ACCESS_SECRET=<minimum 32 characters>
JWT_REFRESH_SECRET=<minimum 32 characters, MUST DIFFER from access>
PASSWORD_PEPPER=<minimum 16 characters>
STORAGE_SIGNING_SECRET=<minimum 32 characters>
ANONYMITY_HASH_SECRET=<minimum 32 characters>
ENCRYPTION_KEY_BASE64=<valid base64>

# Services
REDIS_URL=redis://127.0.0.1:6379/5
STORAGE_ENDPOINT=http://127.0.0.1:9000
```

### Step 3: Start Services with Docker Compose

Navigate to the backend directory and start all services:

```powershell
cd D:\GO-Lessons\pro-go\Gapak\backend

# Start all services (PostgreSQL, Redis, MinIO, run migrations, start API)
docker-compose up --build

# Or just start the database services without the API:
docker-compose up postgres redis minio minio-init
```

This will:
- Create and start PostgreSQL 16 with database `gapak`
- Create and start Redis 7
- Create and start MinIO (S3-compatible storage)
- Automatically run database migrations
- Start the API server

### Step 4: Verify Everything is Running

```powershell
# Check running containers
docker ps

# Check logs for specific service
docker logs gapak-postgres
docker logs gapak-redis
docker logs gapak-minio
docker logs gapak-api
```

### Step 5: Test the API

```powershell
# Test health endpoint
curl http://localhost:8080/health

# Access API
curl http://localhost:8080/api/v1/...
```

## Troubleshooting

### Issue: "Database connection failed"
**Solution:**
1. Ensure PostgreSQL container is running: `docker ps | grep gapak-postgres`
2. Check credentials in `.env` match docker-compose.yml
3. Check logs: `docker logs gapak-postgres`

### Issue: "Redis connection failed"
**Solution:**
1. Ensure Redis container is running: `docker ps | grep gapak-redis`
2. Verify REDIS_URL in `.env` is correct
3. Check logs: `docker logs gapak-redis`

### Issue: "Port already in use (5432, 6379, 9000, 8080)"
**Solution:**
```powershell
# Find process using port
netstat -ano | findstr :5432
# Kill process
taskkill /PID <PID> /F
```

Or change the port in docker-compose.yml:
```yaml
postgres:
  ports:
    - "5433:5432"  # Change from 5432 to 5433
```

### Issue: "Docker daemon not running"
**Solution:**
1. Open Docker Desktop application
2. Wait for it to fully start (check system tray)
3. Try commands again

### Issue: "Configuration validation failed"
**Check .env for:**
- All required variables are present
- Secrets are at least minimum length (32 chars for secrets, 16 for pepper)
- JWT_REFRESH_TTL > JWT_ACCESS_TTL (720h > 15m ✅)
- CORS_ORIGINS contains at least one URL (http://localhost:3000 ✅)

## Running Services Locally (Without Docker - Not Recommended)

If you need to run services locally without Docker:

### PostgreSQL Setup
1. Install PostgreSQL 16: https://www.postgresql.org/download/windows/
2. Create database and user:
   ```sql
   CREATE DATABASE gapak;
   CREATE USER gapak WITH PASSWORD 'gapak';
   ALTER ROLE gapak SET client_encoding TO 'utf8';
   ALTER ROLE gapak SET default_transaction_isolation TO 'read committed';
   ALTER ROLE gapak SET default_transaction_deferrable TO on;
   ALTER ROLE gapak SET default_transaction_read_only TO off;
   GRANT ALL PRIVILEGES ON DATABASE gapak TO gapak;
   ```

### Redis Setup
1. Download Redis from: https://github.com/microsoftarchive/redis/releases
2. Extract and run: `redis-server.exe`
3. Verify: `redis-cli ping` (should return "PONG")

### MinIO Setup
1. Download MinIO: https://dl.min.io/server/minio/release/windows-amd64/minio.exe
2. Run: `minio.exe server D:\minio-data`
3. Access: http://localhost:9001

### Database Migrations
```powershell
# Run migrations manually
go run ./cmd/migrate

# Or build first
go build -o bin/gapak-migrate ./cmd/migrate
.\bin\gapak-migrate.exe
```

### Start API Server
```powershell
# Option 1: Run directly
go run ./cmd/api

# Option 2: Build and run
go build -o bin/gapak-api ./cmd/api
.\bin\gapak-api.exe
```

## Development Commands

```powershell
# Tidy dependencies
go mod tidy

# Run tests
go test ./...

# Build all binaries
make build build-worker build-migrate

# Run with hot reload (install air first: go install github.com/cosmtrek/air@latest)
air

# View logs
docker logs -f gapak-api
docker logs -f gapak-postgres
```

## Project Structure

```
backend/
├── cmd/
│   ├── api/          - HTTP API server
│   ├── migrate/      - Database migration runner
│   └── worker/       - Background job worker
├── internal/
│   ├── app/          - Application initialization
│   ├── config/       - Configuration loading
│   ├── domain/       - Domain models and enums
│   ├── modules/      - Feature modules (auth, users, posts, etc.)
│   ├── platform/     - Infrastructure (db, cache, auth, etc.)
│   └── workers/      - Job processors
├── db/
│   └── migrations/   - SQL migrations
├── docs/             - API documentation
├── .env              - Environment variables
├── docker-compose.yml - Docker services definition
├── Dockerfile        - Container build definition
├── Makefile          - Build commands
└── go.mod            - Go dependencies
```

## Environment Variables Explained

| Variable | Purpose | Min Length | Example |
|----------|---------|-----------|---------|
| DATABASE_URL | PostgreSQL connection | - | postgresql://gapak:gapak@localhost/gapak |
| JWT_ACCESS_SECRET | Access token signing key | 32 | random-32-character-string-here-123 |
| JWT_REFRESH_SECRET | Refresh token signing key | 32 | different-random-32-character-string-456 |
| PASSWORD_PEPPER | Password hashing pepper | 16 | pepper-16-chars |
| STORAGE_SIGNING_SECRET | Storage URL signing | 32 | storage-secret-32-chars-minimum-999 |
| ANONYMITY_HASH_SECRET | Anonymity ID hashing | 32 | anon-hash-secret-32-chars-minimum-888 |
| REDIS_URL | Redis connection | - | redis://localhost:6379/5 |
| ENCRYPTION_KEY_BASE64 | Data encryption key | - | Base64-encoded key |

## Next Steps

1. **Install Docker Desktop** (if not already installed)
2. **Run:** `docker-compose up --build` from the backend directory
3. **Wait** for all services to start and migrations to complete
4. **Test:** `curl http://localhost:8080/api/v1/...` or access API
5. **View logs:** `docker logs gapak-api` to monitor

## Support

If you encounter issues:
1. Check `.env` file for all required variables
2. Verify Docker is running: `docker ps`
3. Check service logs: `docker logs <service-name>`
4. Ensure ports 5432, 6379, 9000, 8080 are not in use
5. Review environment variables match docker-compose.yml

---

**Last Updated:** 2026-05-16
**Status:** All configuration issues fixed ✅
**Ready to Run:** With Docker Desktop installed
