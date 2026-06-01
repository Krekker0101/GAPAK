#!/usr/bin/env pwsh
#Requires -Version 5.1

<#
.SYNOPSIS
Gapak Full Stack Startup Script - Starts Backend (Go/Fiber) + Frontend (Next.js)
.DESCRIPTION
This script sets up environment variables and starts both backend and frontend services.
#>

$ErrorActionPreference = "Continue"

$ProjectRoot = "d:\GO-Lessons\pro-go\Gapak"
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "front"
$BackendBin = Join-Path $BackendDir "cmd\api\main.go"
$MigrateCmd = Join-Path $BackendDir "cmd\migrate\main.go"

# Colors for output
$Colors = @{
    Success = "Green"
    Error   = "Red"
    Warning = "Yellow"
    Info    = "Cyan"
}

function Write-Status {
    param(
        [string]$Message,
        [ValidateSet("Success", "Error", "Warning", "Info")]
        [string]$Type = "Info"
    )
    $Color = $Colors[$Type]
    Write-Host "[$Type] $Message" -ForegroundColor $Color
}

function Test-PortInUse {
    param([int]$Port)
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $client.Connect("127.0.0.1", $Port)
        $client.Close()
        return $true
    } catch {
        return $false
    }
}

Clear-Host
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          GAPAK - Full Stack Startup                    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Validation
Write-Status "Checking directories..." -Type "Info"

if (-not (Test-Path $BackendDir)) {
    Write-Status "Backend directory not found: $BackendDir" -Type "Error"
    exit 1
}

if (-not (Test-Path $FrontendDir)) {
    Write-Status "Frontend directory not found: $FrontendDir" -Type "Error"
    exit 1
}

Write-Status "Directories found ✓" -Type "Success"

# Set environment variables
Write-Status "Setting environment variables..." -Type "Info"
$env:DATABASE_URL = "postgresql://postgres:5433@127.0.0.1:5432/gapak?sslmode=disable"
$env:APP_PORT = "8080"
$env:GAPAK_BACKEND_URL = "http://localhost:8080"

Write-Status "DATABASE_URL: $env:DATABASE_URL" -Type "Info"
Write-Status "APP_PORT: $env:APP_PORT" -Type "Info"

# Check if ports are available
Write-Status "Checking ports..." -Type "Info"

if (Test-PortInUse 8080) {
    Write-Status "Port 8080 is in use (Backend may already be running)" -Type "Warning"
}

if (Test-PortInUse 3000) {
    Write-Status "Port 3000 is in use (Frontend may already be running)" -Type "Warning"
}

if (Test-PortInUse 5432) {
    Write-Status "Port 5432 is in use (PostgreSQL)" -Type "Info"
}

# Backend setup
Write-Status "Backend - Running go mod tidy..." -Type "Info"
Push-Location $BackendDir
try {
    & go mod tidy
    if ($LASTEXITCODE -ne 0) {
        Write-Status "go mod tidy failed" -Type "Error"
        exit 1
    }
    Write-Status "Dependencies updated ✓" -Type "Success"

    Write-Status "Backend - Running migrations..." -Type "Info"
    & go run ./cmd/migrate/main.go
    if ($LASTEXITCODE -ne 0) {
        Write-Status "Migrations failed (continuing anyway...)" -Type "Warning"
    } else {
        Write-Status "Migrations completed ✓" -Type "Success"
    }
} finally {
    Pop-Location
}

# Start Backend
Write-Status "Starting Backend API (port 8080)..." -Type "Info"
$BackendProcess = Start-Process `
    -FilePath "cmd.exe" `
    -ArgumentList "/k", "cd /d $BackendDir && set DATABASE_URL=$env:DATABASE_URL && set APP_PORT=8080 && go run ./cmd/api/main.go" `
    -WindowStyle Normal `
    -PassThru

if (-not $BackendProcess) {
    Write-Status "Failed to start backend" -Type "Error"
    exit 1
}

Write-Status "Backend started (PID: $($BackendProcess.Id))" -Type "Success"

# Wait for backend to be ready
Write-Status "Waiting for backend to be ready..." -Type "Info"
$BackendReady = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:8080/health/ready" -TimeoutSec 2 -ErrorAction Stop
        $BackendReady = $true
        break
    } catch {
        Start-Sleep -Seconds 1
    }
}

if ($BackendReady) {
    Write-Status "Backend is ready ✓" -Type "Success"
} else {
    Write-Status "Backend did not respond to health check (it may still be starting)" -Type "Warning"
}

# Start Frontend
Write-Status "Starting Frontend (port 3000)..." -Type "Info"
$FrontendProcess = Start-Process `
    -FilePath "cmd.exe" `
    -ArgumentList "/k", "cd /d $FrontendDir && npm run dev" `
    -WindowStyle Normal `
    -PassThru

if (-not $FrontendProcess) {
    Write-Status "Failed to start frontend" -Type "Error"
    exit 1
}

Write-Status "Frontend started (PID: $($FrontendProcess.Id))" -Type "Success"

# Summary
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                    ✓ GAPAK Running                     ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "⚙️  Backend:  http://localhost:8080" -ForegroundColor Cyan
Write-Host "💚 Health:   http://localhost:8080/health/ready" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend PID:  $($BackendProcess.Id)" -ForegroundColor Yellow
Write-Host "Frontend PID: $($FrontendProcess.Id)" -ForegroundColor Yellow
Write-Host ""
Write-Host "To stop: Close the terminal windows or run stop-gapak.bat" -ForegroundColor Gray
Write-Host ""

# Keep script running
Write-Host "Press Ctrl+C to exit (terminal windows will stay open)..." -ForegroundColor Gray
Read-Host
