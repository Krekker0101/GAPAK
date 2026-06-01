#!/usr/bin/env pwsh

# Quick registration helper
# Run: .\register-test-user.ps1

$ErrorActionPreference = "Stop"

Write-Host "🔐 Gapak Test User Registration" -ForegroundColor Cyan
Write-Host ""

$apiUrl = "http://localhost:8080/api/v1"
$username = "testuser"
$email = "test@example.com"
$displayName = "Test User"
$password = "TestPassword123"

try {
    # Get CSRF token
    Write-Host "📡 Getting CSRF token..." -ForegroundColor Yellow
    $csrf = Invoke-WebRequest -Uri "$apiUrl/auth/csrf" -Method GET
    $csrfData = $csrf.Content | ConvertFrom-Json
    $token = $csrfData.data.csrfToken
    Write-Host "✓ Token: $($token.Substring(0, 16))..." -ForegroundColor Green

    # Register
    Write-Host "👤 Registering user '$username'..." -ForegroundColor Yellow
    
    $body = @{
        username = $username
        email = $email
        displayName = $displayName
        password = $password
        preferAnonymous = $false
    } | ConvertTo-Json

    $result = Invoke-WebRequest -Uri "$apiUrl/auth/register" `
        -Method POST `
        -ContentType "application/json" `
        -Headers @{ "X-CSRF-Token" = $token } `
        -Body $body `
        -WebSession (New-Object Microsoft.PowerShell.Commands.WebRequestSession)

    $data = $result.Content | ConvertFrom-Json
    
    if ($data.success) {
        Write-Host "✓ Registration successful!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📝 Login credentials:" -ForegroundColor Cyan
        Write-Host "   Username: $username"
        Write-Host "   Password: $password"
        Write-Host ""
        Write-Host "🌐 Open: http://localhost:3000/login" -ForegroundColor Cyan
    } else {
        Write-Host "✗ Failed: $($data.error.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Error: $_" -ForegroundColor Red
    exit 1
}
