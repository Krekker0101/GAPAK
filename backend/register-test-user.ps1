# Register a test user for authentication testing
# This script helps you create the first test user

param(
    [string]$ApiUrl = "http://localhost:8080/api/v1",
    [string]$Username = "testuser",
    [string]$Email = "test@example.com",
    [string]$DisplayName = "Test User",
    [string]$Password = "TestPassword123"
)

Write-Host "=== Gapak Test User Registration ===" -ForegroundColor Cyan
Write-Host "Target API: $ApiUrl" -ForegroundColor Gray
Write-Host ""

# Step 1: Get CSRF token
Write-Host "Step 1: Fetching CSRF token..." -ForegroundColor Yellow

try {
    $csrfResponse = Invoke-WebRequest -Uri "$ApiUrl/auth/csrf" `
        -Method GET `
        -ContentType "application/json" `
        -SessionVariable "session" `
        -ErrorAction Stop

    $csrfData = $csrfResponse.Content | ConvertFrom-Json
    $csrfToken = $csrfData.data.csrfToken
    
    Write-Host "✓ CSRF Token obtained: $($csrfToken.Substring(0, 20))..." -ForegroundColor Green
    Write-Host ""
}
catch {
    Write-Host "✗ Failed to get CSRF token: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Register the user
Write-Host "Step 2: Registering test user..." -ForegroundColor Yellow
Write-Host "  Username: $Username"
Write-Host "  Email: $Email"
Write-Host "  Password: $Password" -ForegroundColor DarkGray
Write-Host ""

$registerPayload = @{
    username = $Username
    email = $Email
    displayName = $DisplayName
    password = $Password
    preferAnonymous = $false
} | ConvertTo-Json

try {
    $registerResponse = Invoke-WebRequest -Uri "$ApiUrl/auth/register" `
        -Method POST `
        -ContentType "application/json" `
        -Headers @{
            "X-CSRF-Token" = $csrfToken
        } `
        -Body $registerPayload `
        -WebSession $session `
        -ErrorAction Stop

    $registerData = $registerResponse.Content | ConvertFrom-Json
    
    if ($registerData.success) {
        Write-Host "✓ User registered successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "User Details:" -ForegroundColor Cyan
        Write-Host "  ID: $($registerData.data.user.id)"
        Write-Host "  Username: $($registerData.data.user.username)"
        Write-Host "  Email: $($registerData.data.user.email)"
        Write-Host ""
        Write-Host "Access Token TTL: $($registerData.data.accessTokenTtl) ms"
        Write-Host ""
        Write-Host "You can now login with these credentials:" -ForegroundColor Cyan
        Write-Host "  Login: $Username"
        Write-Host "  Password: $Password"
    }
    else {
        Write-Host "✗ Registration failed" -ForegroundColor Red
        Write-Host $registerResponse.Content
        exit 1
    }
}
catch {
    Write-Host "✗ Registration request failed: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorContent = $_.Exception.Response.Content.ReadAsStream() | ForEach-Object { [System.IO.StreamReader]::new($_).ReadToEnd() }
        Write-Host "Response: $errorContent" -ForegroundColor Red
    }
    exit 1
}

Write-Host ""
Write-Host "=== Registration Complete ===" -ForegroundColor Green
