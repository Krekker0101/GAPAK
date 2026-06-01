#!/usr/bin/env pwsh

<#
.SYNOPSIS
Stop Gapak services (Backend and Frontend)
#>

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          Stopping GAPAK Services                       ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Kill processes by port
function Stop-PortProcess {
    param(
        [int]$Port,
        [string]$Name
    )
    
    try {
        $process = Get-NetTCPConnection -LocalPort $Port -ErrorAction Stop | Select-Object -ExpandProperty OwningProcess | Get-Process -ErrorAction Stop
        if ($process) {
            Write-Host "Stopping $Name (Port $Port, PID $($process.Id))..." -ForegroundColor Yellow
            Stop-Process -Id $process.Id -Force -ErrorAction Stop
            Write-Host "✓ $Name stopped" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠ $Name not running or could not be stopped" -ForegroundColor Gray
    }
}

# Stop by process name (more reliable)
function Stop-ProcessByName {
    param(
        [string]$Name,
        [string]$Description
    )
    
    $processes = Get-Process -Name $Name -ErrorAction SilentlyContinue
    if ($processes) {
        foreach ($proc in $processes) {
            Write-Host "Stopping $Description (PID $($proc.Id))..." -ForegroundColor Yellow
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
        Write-Host "✓ $Description stopped" -ForegroundColor Green
    } else {
        Write-Host "⚠ $Description not running" -ForegroundColor Gray
    }
}

# Try to stop by name first (more reliable)
Write-Host "Looking for running services..." -ForegroundColor Cyan
Write-Host ""

Stop-ProcessByName -Name "cmd" -Description "Backend service"
Stop-ProcessByName -Name "node" -Description "Frontend service (npm)"

# Also try by port if above didn't work
Write-Host ""
Write-Host "Checking ports..." -ForegroundColor Cyan
Stop-PortProcess -Port 8080 -Name "Backend"
Stop-PortProcess -Port 3000 -Name "Frontend"

Write-Host ""
Write-Host "✓ Done! All services stopped." -ForegroundColor Green
Write-Host ""
