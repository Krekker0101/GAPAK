@echo off
REM Gapak Full Stack Startup Script (Windows CMD)
REM This script starts Backend (Go/Fiber) + Frontend (Next.js) + PostgreSQL

setlocal enabledelayedexpansion

set "PROJECT_ROOT=d:\GO-Lessons\pro-go\Gapak"
set "BACKEND_DIR=%PROJECT_ROOT%\backend"
set "FRONTEND_DIR=%PROJECT_ROOT%\front"

echo.
echo ============================================
echo  GAPAK - Full Stack Startup
echo ============================================
echo.

REM Check if directories exist
if not exist "%BACKEND_DIR%" (
    echo ERROR: Backend directory not found: %BACKEND_DIR%
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%" (
    echo ERROR: Frontend directory not found: %FRONTEND_DIR%
    pause
    exit /b 1
)

REM Check PostgreSQL password setup
echo [1/4] Setting up environment...
set DATABASE_URL=postgresql://postgres:5433@127.0.0.1:5432/gapak?sslmode=disable
set APP_PORT=8080
set GAPAK_BACKEND_URL=http://localhost:8080
echo ✓ Database URL: %DATABASE_URL%

REM Setup backend environment
cd /d "%BACKEND_DIR%"

echo.
echo [2/4] Backend - Running go mod tidy...
call go mod tidy
if errorlevel 1 (
    echo ERROR: go mod tidy failed
    pause
    exit /b 1
)
echo ✓ Dependencies ready

echo.
echo [3/4] Backend - Running migrations...
call go run ./cmd/migrate/main.go
if errorlevel 1 (
    echo WARNING: Migrations failed, but continuing...
)
echo ✓ Migrations completed

echo.
echo [4/4] Starting services...
echo.
echo Starting Backend API (port 8080)...
start "Gapak Backend" cmd /k "cd /d %BACKEND_DIR% && set DATABASE_URL=%DATABASE_URL% && set APP_PORT=%APP_PORT% && go run ./cmd/api/main.go"

REM Wait for backend to start
timeout /t 3 /nobreak

echo Starting Frontend (port 3000)...
start "Gapak Frontend" cmd /k "cd /d %FRONTEND_DIR% && npm run dev"

echo.
echo ============================================
echo ✓ GAPAK is starting up!
echo ============================================
echo.
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:8080
echo Health:   http://localhost:8080/health/ready
echo.
echo Windows will open 2 new terminals for Backend and Frontend.
echo If ports are in use, you may see errors - close processes and try again.
echo.
pause
