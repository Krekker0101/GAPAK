@echo off
REM Gapak Startup Script - Windows CMD Version
REM This starts the complete Gapak stack: Backend + Frontend

setlocal enabledelayedexpansion

set "ROOT=d:\GO-Lessons\pro-go\Gapak"
set "BACKEND=%ROOT%\backend"
set "FRONTEND=%ROOT%\front"

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║          GAPAK - Full Stack Startup                    ║
echo ╚════════════════════════════════════════════════════════╝
echo.

REM Validate directories exist
if not exist "%BACKEND%" (
    echo ERROR: Backend not found at %BACKEND%
    pause
    exit /b 1
)

if not exist "%FRONTEND%" (
    echo ERROR: Frontend not found at %FRONTEND%
    pause
    exit /b 1
)


echo [INFO] Setting environment variables...
set "DATABASE_URL=postgresql://postgres:5433@127.0.0.1:5432/gapak?sslmode=disable"
set "APP_PORT=8080"
set "APP_ENV=development"
set "MIGRATIONS_DIR=db/migrations"

echo [INFO] Database URL configured: %DATABASE_URL%
echo [INFO] Backend port: %APP_PORT%
echo.

REM Check for required tools
echo [INFO] Checking for required tools...

where go >nul 2>&1
if errorlevel 1 (
    echo ERROR: Go is not installed or not in PATH
    echo Please install Go from https://go.dev/dl/
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('go version') do set "GO_VERSION=%%i"
for /f "tokens=*" %%i in ('npm -v') do set "NPM_VERSION=%%i"

echo [OK] Go: %GO_VERSION%
echo [OK] npm: v%NPM_VERSION%
echo.

REM Backend preparation
echo [1/5] Backend - Running go mod tidy...
cd /d "%BACKEND%"
call go mod tidy
if errorlevel 1 (
    echo ERROR: go mod tidy failed
    pause
    exit /b 1
)
echo [OK] Dependencies tidy'd
echo.

echo [2/5] Backend - Running migrations...
call go run ./cmd/migrate/main.go
if errorlevel 1 (
    echo WARNING: Migrations may have failed, but continuing...
)
echo.

REM Start Backend in new window
echo [3/5] Starting Backend API (port 8080)...
start "Gapak Backend" /D "%BACKEND%" cmd /k ^
    "set DATABASE_URL=%DATABASE_URL%& ^
     set APP_PORT=%APP_PORT%& ^
     set APP_ENV=%APP_ENV%& ^
     set MIGRATIONS_DIR=%MIGRATIONS_DIR%& ^
     go run ./cmd/api/main.go"

timeout /t 5 /nobreak >nul

REM Start Frontend in new window
echo [4/5] Starting Frontend (port 3000)...
start "Gapak Frontend" /D "%FRONTEND%" cmd /k "npm run dev"

echo [5/5] Startup complete!
echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║              ✓ GAPAK is Starting Up!                   ║
echo ╚════════════════════════════════════════════════════════╝
echo.
echo 📱 Frontend:  http://localhost:3000
echo ⚙️  Backend:   http://localhost:8080
echo 💚 Health:    http://localhost:8080/health/ready
echo.
echo Note: New terminal windows will open for Backend and Frontend.
echo If you see errors, check the terminal output.
echo.
pause
