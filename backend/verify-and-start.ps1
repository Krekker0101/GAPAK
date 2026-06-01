#!/usr/bin/env powershell
# Gapak Backend - Automated Verification & Startup Script
# This script verifies that all fixes are in place and Docker is ready

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         GAPAK BACKEND - VERIFICATION & STARTUP SCRIPT         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Define the backend directory
$backendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $backendDir ".env"

Write-Host "📁 Backend Directory: $backendDir" -ForegroundColor Yellow
Write-Host ""

# Function to check if command exists
function Test-CommandExists {
    param($command)
    try {
        if (Get-Command $command -ErrorAction Stop) { return $true }
    } catch {
        return $false
    }
}

# Function to check port availability
function Test-PortOpen {
    param($port)
    try {
        $socket = New-Object System.Net.Sockets.TcpClient
        $socket.Connect("127.0.0.1", $port)
        $socket.Close()
        return $false
    } catch {
        return $true
    }
}

# ============ VERIFICATION CHECKS ============
Write-Host "🔍 VERIFICATION CHECKS:" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

# Check 1: Go Installation
Write-Host -NoNewline "Go Installation... "
if (Test-Path "C:\Program Files\Go\bin\go.exe") {
    $goVersion = & "C:\Program Files\Go\bin\go.exe" version 2>&1 | Select-String "go version"
    Write-Host "✅ $goVersion" -ForegroundColor Green
} else {
    Write-Host "❌ NOT FOUND" -ForegroundColor Red
}

# Check 2: Docker Installation
Write-Host -NoNewline "Docker Installation... "
if (Test-CommandExists "docker") {
    $dockerVersion = docker --version 2>&1
    Write-Host "✅ $dockerVersion" -ForegroundColor Green
    
    # Check if Docker daemon is running
    Write-Host -NoNewline "Docker Daemon Status... "
    try {
        $null = docker ps 2>&1
        Write-Host "✅ RUNNING" -ForegroundColor Green
    } catch {
        Write-Host "❌ NOT RUNNING" -ForegroundColor Red
        Write-Host "   → Open Docker Desktop application" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ NOT INSTALLED" -ForegroundColor Red
    Write-Host "   → Download from: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
}

# Check 3: Docker Compose
Write-Host -NoNewline "Docker Compose... "
if (Test-CommandExists "docker-compose") {
    $composeVersion = docker-compose --version 2>&1
    Write-Host "✅ $composeVersion" -ForegroundColor Green
} else {
    Write-Host "❌ NOT FOUND" -ForegroundColor Red
}

# Check 4: .env File
Write-Host -NoNewline ".env Configuration File... "
if (Test-Path $envFile) {
    Write-Host "✅ FOUND" -ForegroundColor Green
    
    # Check critical variables
    Write-Host "   Checking critical variables:" -ForegroundColor Gray
    
    $content = Get-Content $envFile -Raw
    
    if ($content -match "postgresql://gapak:gapak") {
        Write-Host "   ✅ DATABASE_URL: Correct (gapak:gapak)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ DATABASE_URL: Incorrect or missing" -ForegroundColor Red
    }
    
    $jwtAccess = $content | Select-String "^JWT_ACCESS_SECRET=(.+)$" | ForEach-Object { $_.Matches.Groups[1].Value }
    if ($jwtAccess.Length -ge 32) {
        Write-Host "   ✅ JWT_ACCESS_SECRET: Length $($jwtAccess.Length) (required ≥32)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ JWT_ACCESS_SECRET: Length $($jwtAccess.Length) (required ≥32)" -ForegroundColor Red
    }
    
    $jwtRefresh = $content | Select-String "^JWT_REFRESH_SECRET=(.+)$" | ForEach-Object { $_.Matches.Groups[1].Value }
    if ($jwtRefresh.Length -ge 32) {
        Write-Host "   ✅ JWT_REFRESH_SECRET: Length $($jwtRefresh.Length) (required ≥32)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ JWT_REFRESH_SECRET: Length $($jwtRefresh.Length) (required ≥32)" -ForegroundColor Red
    }
    
} else {
    Write-Host "❌ NOT FOUND at $envFile" -ForegroundColor Red
}

# Check 5: Port Availability
Write-Host ""
Write-Host -NoNewline "Port 5432 (PostgreSQL) Available... "
if (Test-PortOpen 5432) {
    Write-Host "✅ AVAILABLE" -ForegroundColor Green
} else {
    Write-Host "❌ IN USE" -ForegroundColor Red
    Write-Host "   → Something is already running on port 5432" -ForegroundColor Yellow
}

Write-Host -NoNewline "Port 6379 (Redis) Available... "
if (Test-PortOpen 6379) {
    Write-Host "✅ AVAILABLE" -ForegroundColor Green
} else {
    Write-Host "❌ IN USE" -ForegroundColor Red
}

Write-Host -NoNewline "Port 9000 (MinIO) Available... "
if (Test-PortOpen 9000) {
    Write-Host "✅ AVAILABLE" -ForegroundColor Green
} else {
    Write-Host "❌ IN USE" -ForegroundColor Red
}

Write-Host -NoNewline "Port 8080 (API) Available... "
if (Test-PortOpen 8080) {
    Write-Host "✅ AVAILABLE" -ForegroundColor Green
} else {
    Write-Host "❌ IN USE" -ForegroundColor Red
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

# ============ STARTUP OPTIONS ============
Write-Host "🚀 STARTUP OPTIONS:" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

if (Test-CommandExists "docker") {
    Write-Host "Option 1: Start all services (recommended)" -ForegroundColor Cyan
    Write-Host '  Command: docker-compose up --build' -ForegroundColor Gray
    Write-Host '  This will: Build images, start all services, run migrations, start API' -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "Option 2: Start in background" -ForegroundColor Cyan
    Write-Host '  Command: docker-compose up -d --build' -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "Option 3: Stop all services" -ForegroundColor Cyan
    Write-Host '  Command: docker-compose down' -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "Option 4: View logs" -ForegroundColor Cyan
    Write-Host '  Command: docker logs -f gapak-api' -ForegroundColor Gray
    Write-Host ""
    
    # Ask user if they want to start
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host ""
    
    $response = Read-Host "Do you want to start Docker services now? (yes/no)"
    
    if ($response -eq "yes" -or $response -eq "y") {
        Write-Host ""
        Write-Host "🔧 Starting Docker Compose..." -ForegroundColor Cyan
        Write-Host ""
        
        # Change to backend directory
        Set-Location $backendDir
        
        # Start docker-compose
        docker-compose up --build
    } else {
        Write-Host ""
        Write-Host "To start later, run:" -ForegroundColor Yellow
        Write-Host "  cd $backendDir" -ForegroundColor Gray
        Write-Host "  docker-compose up --build" -ForegroundColor Gray
        Write-Host ""
    }
} else {
    Write-Host "⚠️  Docker is not installed" -ForegroundColor Red
    Write-Host ""
    Write-Host "To continue, you MUST:" -ForegroundColor Yellow
    Write-Host "1. Install Docker Desktop: https://www.docker.com/products/docker-desktop/" -ForegroundColor Gray
    Write-Host "2. Restart your computer" -ForegroundColor Gray
    Write-Host "3. Run this script again" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Script completed" -ForegroundColor Gray
