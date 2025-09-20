# reCAPTCHA Endpoint Test Script
# This script tests the reCAPTCHA functionality on the login endpoint

$baseUrl = "http://localhost:1338/api/auth/login"
$headers = @{
    "Content-Type" = "application/json"
}

Write-Host "🚀 Testing reCAPTCHA Authentication Endpoint" -ForegroundColor Cyan
Write-Host "Endpoint: $baseUrl" -ForegroundColor Gray
Write-Host "=" * 60 -ForegroundColor Gray

# Test 1: Basic endpoint connectivity
Write-Host "`n📡 Test 1: Basic endpoint connectivity" -ForegroundColor Yellow
try {
    $response1 = Invoke-WebRequest -Uri $baseUrl -Method POST -Headers $headers -Body (@{
        identifier = "test@example.com"
        password = "wrongpassword"
    } | ConvertTo-Json) -ErrorAction Stop
    Write-Host "✅ Endpoint is reachable" -ForegroundColor Green
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 400 -or $statusCode -eq 401) {
        Write-Host "✅ Endpoint is reachable (expected auth failure)" -ForegroundColor Green
    } else {
        Write-Host "❌ Endpoint connectivity failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# Test 2: Without reCAPTCHA token (should check if it's required)
Write-Host "`n🔒 Test 2: Login without reCAPTCHA token" -ForegroundColor Yellow
try {
    $response2 = Invoke-RestMethod -Uri $baseUrl -Method POST -Headers $headers -Body (@{
        identifier = "test@example.com"
        password = "password123"
    } | ConvertTo-Json)
    Write-Host "⚠️  Login succeeded without reCAPTCHA (reCAPTCHA might be optional)" -ForegroundColor Orange
    Write-Host "Response: $($response2 | ConvertTo-Json -Depth 2)" -ForegroundColor Gray
} catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($errorResponse.error -eq "recaptcha_missing" -or $errorResponse.message -like "*reCAPTCHA*") {
        Write-Host "✅ Expected failure: reCAPTCHA is required" -ForegroundColor Green
        Write-Host "Response: $($errorResponse | ConvertTo-Json -Depth 2)" -ForegroundColor Gray
    } elseif ($errorResponse.message -like "*not found*" -or $errorResponse.message -like "*Invalid*") {
        Write-Host "ℹ️  User not found or invalid credentials (reCAPTCHA check passed)" -ForegroundColor Blue
    } else {
        Write-Host "⚠️  Unexpected error: $($_.Exception.Message)" -ForegroundColor Orange
    }
}

# Test 3: With invalid reCAPTCHA token
Write-Host "`n🛡️  Test 3: Login with invalid reCAPTCHA token" -ForegroundColor Yellow
try {
    $response3 = Invoke-RestMethod -Uri $baseUrl -Method POST -Headers $headers -Body (@{
        identifier = "test@example.com"
        password = "password123"
        recaptchaToken = "invalid_token_12345"
    } | ConvertTo-Json)
    Write-Host "❌ Login succeeded with invalid token (security issue!)" -ForegroundColor Red
    Write-Host "Response: $($response3 | ConvertTo-Json -Depth 2)" -ForegroundColor Gray
} catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($errorResponse.error -eq "recaptcha_failed" -or $errorResponse.message -like "*reCAPTCHA*") {
        Write-Host "✅ Expected failure: Invalid reCAPTCHA token rejected" -ForegroundColor Green
        Write-Host "Response: $($errorResponse | ConvertTo-Json -Depth 2)" -ForegroundColor Gray
    } else {
        Write-Host "ℹ️  Other error (might be user-related): $($errorResponse.message)" -ForegroundColor Blue
    }
}

# Test 4: With empty reCAPTCHA token
Write-Host "`n🔍 Test 4: Login with empty reCAPTCHA token" -ForegroundColor Yellow
try {
    $response4 = Invoke-RestMethod -Uri $baseUrl -Method POST -Headers $headers -Body (@{
        identifier = "test@example.com"
        password = "password123"
        recaptchaToken = ""
    } | ConvertTo-Json)
    Write-Host "⚠️  Login succeeded with empty token" -ForegroundColor Orange
} catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($errorResponse.message -like "*reCAPTCHA*") {
        Write-Host "✅ Expected failure: Empty reCAPTCHA token rejected" -ForegroundColor Green
    } else {
        Write-Host "ℹ️  Other error: $($errorResponse.message)" -ForegroundColor Blue
    }
}

# Test 5: Check if endpoint accepts malformed requests
Write-Host "`n🔧 Test 5: Malformed request handling" -ForegroundColor Yellow
try {
    $response5 = Invoke-RestMethod -Uri $baseUrl -Method POST -Headers $headers -Body "invalid json"
    Write-Host "❌ Endpoint accepted malformed JSON" -ForegroundColor Red
} catch {
    Write-Host "✅ Malformed requests properly rejected" -ForegroundColor Green
}

# Summary and recommendations
Write-Host "`n" + ("=" * 60) -ForegroundColor Gray
Write-Host "🎯 Test Summary & Recommendations" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray

Write-Host "`n📋 Next Steps for Complete Testing:" -ForegroundColor White
Write-Host "1. Start your Strapi server: cd D:\tst && npm run dev" -ForegroundColor Gray
Write-Host "2. Configure environment variables in .env file" -ForegroundColor Gray
Write-Host "3. Create a test user in your database" -ForegroundColor Gray
Write-Host "4. Get a real reCAPTCHA token from the frontend" -ForegroundColor Gray
Write-Host "5. Test the complete login flow with valid credentials + reCAPTCHA" -ForegroundColor Gray

Write-Host "`n🔑 To get a real reCAPTCHA token:" -ForegroundColor White
Write-Host "- Start the frontend: cd D:\tst\frontend && npm start" -ForegroundColor Gray
Write-Host "- Open browser dev tools → Network tab" -ForegroundColor Gray
Write-Host "- Complete the reCAPTCHA on the login form" -ForegroundColor Gray
Write-Host "- Copy the token from the network request" -ForegroundColor Gray

Write-Host "`n⚙️  Configuration Check:" -ForegroundColor White
$envExists = Test-Path "D:\tst\.env"
if ($envExists) {
    Write-Host "✅ .env file exists" -ForegroundColor Green
    $envContent = Get-Content "D:\tst\.env" -ErrorAction SilentlyContinue
    $hasRecaptchaSecret = $envContent -like "*RECAPTCHA_SECRET_KEY*"
    $hasRecaptchaRequired = $envContent -like "*RECAPTCHA_REQUIRED*"
    
    if ($hasRecaptchaSecret) {
        Write-Host "✅ RECAPTCHA_SECRET_KEY configured" -ForegroundColor Green
    } else {
        Write-Host "⚠️  RECAPTCHA_SECRET_KEY not found in .env" -ForegroundColor Orange
    }
    
    if ($hasRecaptchaRequired) {
        Write-Host "✅ RECAPTCHA_REQUIRED configured" -ForegroundColor Green
    } else {
        Write-Host "⚠️  RECAPTCHA_REQUIRED not found in .env" -ForegroundColor Orange
    }
} else {
    Write-Host "⚠️  .env file not found - create one with RECAPTCHA_SECRET_KEY" -ForegroundColor Orange
}

Write-Host "`n✨ reCAPTCHA Endpoint Testing Complete!" -ForegroundColor Green
Write-Host "For detailed testing instructions, see: RECAPTCHA_TESTING_GUIDE.md" -ForegroundColor Gray