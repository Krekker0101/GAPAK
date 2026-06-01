$ErrorActionPreference = "Continue"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $root "backend\var\dev-pids.json"

if (-not (Test-Path -LiteralPath $pidFile)) {
    Write-Host "No dev PID file found at $pidFile"
    exit 0
}

$items = Get-Content -Raw $pidFile | ConvertFrom-Json
if ($null -eq $items) {
    Write-Host "No dev processes recorded."
    exit 0
}

if ($items -isnot [System.Array]) {
    $items = @($items)
}

foreach ($item in $items) {
    $process = Get-Process -Id $item.Id -ErrorAction SilentlyContinue
    if ($null -eq $process) {
        Write-Host "$($item.Name) process $($item.Id) is not running"
        continue
    }

    Write-Host "Stopping $($item.Name) process $($item.Id)"
    Stop-Process -Id $item.Id -Force -ErrorAction SilentlyContinue
}

Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
Write-Host "Local dev services stopped."
