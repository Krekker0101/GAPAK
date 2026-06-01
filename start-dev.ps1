param(
    [int]$PostgresPort = 5432,
    [int]$ApiPort = 8080,
    [int]$FrontendPort = 3000
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$front = Join-Path $root "front"
$runtime = Join-Path $backend "var"
$logs = Join-Path $runtime "logs"
$pgData = Join-Path $runtime "pgdata"
$pidFile = Join-Path $runtime "dev-pids.json"
$postgresBin = "C:\Program Files\PostgreSQL\18\bin"
$postgresExe = Join-Path $postgresBin "postgres.exe"
$initdbExe = Join-Path $postgresBin "initdb.exe"
$psqlExe = Join-Path $postgresBin "psql.exe"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

function Test-PortListening {
    param([int]$Port)
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $client.Connect("127.0.0.1", $Port)
        return $true
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Wait-Http {
    param(
        [string]$Url,
        [int]$Seconds = 40
    )
    for ($i = 0; $i -lt $Seconds; $i++) {
        try {
            Invoke-RestMethod -Uri $Url -TimeoutSec 2 | Out-Null
            return $true
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    return $false
}

function Wait-Postgres {
    param([int]$Port)
    for ($i = 0; $i -lt 40; $i++) {
        & $psqlExe -h 127.0.0.1 -p $Port -U gapak -d postgres -tAc "SELECT 1" *> $null
        if ($LASTEXITCODE -eq 0) {
            return $true
        }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

Ensure-Directory $runtime
Ensure-Directory $logs

if (-not (Test-Path -LiteralPath $postgresExe)) {
    throw "PostgreSQL 18 binaries were not found at $postgresBin"
}

if (-not (Test-Path -LiteralPath (Join-Path $pgData "PG_VERSION"))) {
    Write-Host "Initializing local PostgreSQL data directory at $pgData"
    & $initdbExe -D $pgData -U gapak -A trust --encoding=UTF8 --no-locale
    if ($LASTEXITCODE -ne 0) {
        throw "PostgreSQL initdb failed with exit code $LASTEXITCODE"
    }
}

$processes = @()

if (-not (Test-PortListening $PostgresPort)) {
    Write-Host "Starting local PostgreSQL on port $PostgresPort"
    $pgStdout = Join-Path $logs "postgres-$timestamp.out.log"
    $pgStderr = Join-Path $logs "postgres-$timestamp.err.log"
    $pg = Start-Process `
        -FilePath $postgresExe `
        -ArgumentList @("-D", $pgData, "-p", "$PostgresPort") `
        -WindowStyle Hidden `
        -RedirectStandardOutput $pgStdout `
        -RedirectStandardError $pgStderr `
        -PassThru
    $processes += [pscustomobject]@{ Name = "postgres"; Id = $pg.Id; Log = $pgStderr }
}

if (-not (Wait-Postgres $PostgresPort)) {
    throw "PostgreSQL did not become ready on port $PostgresPort"
}

$dbExists = & $psqlExe -h 127.0.0.1 -p $PostgresPort -U gapak -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='gapak'"
if (($dbExists | Out-String).Trim() -ne "1") {
    Write-Host "Creating database gapak"
    & $psqlExe -h 127.0.0.1 -p $PostgresPort -U gapak -d postgres -c "CREATE DATABASE gapak"
    if ($LASTEXITCODE -ne 0) {
        throw "CREATE DATABASE gapak failed with exit code $LASTEXITCODE"
    }
}

$env:DATABASE_URL = "postgresql://gapak@127.0.0.1:$PostgresPort/gapak?sslmode=disable"
$env:APP_PORT = "$ApiPort"
$env:GAPAK_BACKEND_URL = "http://127.0.0.1:$ApiPort"
$env:NEXT_PUBLIC_API_BASE_URL = "/api/v1"

Write-Host "Running backend migrations"
Push-Location $backend
try {
    go run ./cmd/migrate
    if ($LASTEXITCODE -ne 0) {
        throw "Backend migrations failed with exit code $LASTEXITCODE"
    }
    go build -o bin\gapak-api-dev.exe ./cmd/api
    if ($LASTEXITCODE -ne 0) {
        throw "Backend API build failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}

if (-not (Test-PortListening $ApiPort)) {
    Write-Host "Starting Gapak API on port $ApiPort"
    $apiStdout = Join-Path $logs "api-$timestamp.out.log"
    $apiStderr = Join-Path $logs "api-$timestamp.err.log"
    $api = Start-Process `
        -FilePath (Join-Path $backend "bin\gapak-api-dev.exe") `
        -WorkingDirectory $backend `
        -WindowStyle Hidden `
        -RedirectStandardOutput $apiStdout `
        -RedirectStandardError $apiStderr `
        -PassThru
    $processes += [pscustomobject]@{ Name = "api"; Id = $api.Id; Log = $apiStderr }
}

if (-not (Wait-Http "http://127.0.0.1:$ApiPort/health/live")) {
    throw "Gapak API did not become ready on port $ApiPort"
}

if (-not (Test-Path -LiteralPath (Join-Path $front "node_modules"))) {
    throw "Frontend dependencies are missing. Run npm install in $front first."
}

if (-not (Test-PortListening $FrontendPort)) {
    Write-Host "Starting Next.js frontend on port $FrontendPort"
    $frontStdout = Join-Path $logs "front-$timestamp.out.log"
    $frontStderr = Join-Path $logs "front-$timestamp.err.log"
    $frontProcess = Start-Process `
        -FilePath "npm.cmd" `
        -ArgumentList @("run", "dev", "--", "-p", "$FrontendPort") `
        -WorkingDirectory $front `
        -WindowStyle Hidden `
        -RedirectStandardOutput $frontStdout `
        -RedirectStandardError $frontStderr `
        -PassThru
    $processes += [pscustomobject]@{ Name = "frontend"; Id = $frontProcess.Id; Log = $frontStderr }
}

$processes | ConvertTo-Json | Set-Content -Path $pidFile -Encoding UTF8

Write-Host ""
Write-Host "Gapak is running."
Write-Host "Frontend: http://localhost:$FrontendPort"
Write-Host "Backend:  http://localhost:$ApiPort"
Write-Host "Health:   http://localhost:$ApiPort/health/ready"
Write-Host "Logs:     $logs"
Write-Host ""
Write-Host "To stop local dev services, run:"
Write-Host "powershell -ExecutionPolicy Bypass -File .\stop-dev.ps1"
