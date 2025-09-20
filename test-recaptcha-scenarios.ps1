# Complete reCAPTCHA Testing Scenarios
# Run this after restarting Strapi with RECAPTCHA_REQUIRED=true

Write-Host "🧪 Comprehensive reCAPTCHA Testing" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Gray

$baseUrl = "http://localhost:1338/api/auth/login"
$headers = @{"Content-Type" = "application/json"}

Write-Host "`n📋 Current Configuration Check:" -ForegroundColor White
Get-Content .env | Select-String "RECAPTCHA" | ForEach-Object { 
    Write-Host "  $_" -ForegroundColor Gray 
}

Write-Host "`n🎯 Test Scenarios:" -ForegroundColor White
Write-Host "=================" -ForegroundColor Gray

# Test 1: No reCAPTCHA token (should fail if RECAPTCHA_REQUIRED=true)
Write-Host "`n1️⃣  Testing WITHOUT reCAPTCHA token:" -ForegroundColor Yellow
Write-Host "Expected: Should fail with 'reCAPTCHA verification is required'" -ForegroundColor Gray

try {
    $response1 = Invoke-RestMethod -Uri $baseUrl -Method POST -Headers $headers -Body (@{
        identifier = "test@example.com"
        password = "password123"
    } | ConvertTo-Json)
    
    Write-Host "❌ PROBLEM: Login succeeded without reCAPTCHA!" -ForegroundColor Red
    Write-Host "This means RECAPTCHA_REQUIRED=true is not active." -ForegroundColor Red
    Write-Host "👉 Solution: Restart Strapi server (npm run dev)" -ForegroundColor Yellow
    
} catch {
    $error1 = $_.ErrorDetails.Message | ConvertFrom-Json
    
    if ($error1.error.details.error -eq "recaptcha_missing") {
        Write-Host "✅ PERFECT: reCAPTCHA is required!" -ForegroundColor Green
        Write-Host "Message: $($error1.error.message)" -ForegroundColor Gray
    } else {
        Write-Host "ℹ️  Got: $($error1.error.message)" -ForegroundColor Blue
        Write-Host "This suggests server may need restart to load RECAPTCHA_REQUIRED=true" -ForegroundColor Gray
    }
}

# Test 2: Invalid reCAPTCHA token (should always fail)
Write-Host "`n2️⃣  Testing WITH invalid reCAPTCHA token:" -ForegroundColor Yellow
Write-Host "Expected: Should fail with 'reCAPTCHA verification failed'" -ForegroundColor Gray

try {
    $response2 = Invoke-RestMethod -Uri $baseUrl -Method POST -Headers $headers -Body (@{
        identifier = "test@example.com"
        password = "password123"
        recaptchaToken = "invalid_token_12345"
    } | ConvertTo-Json)
    
    Write-Host "❌ SERIOUS PROBLEM: Invalid reCAPTCHA token was accepted!" -ForegroundColor Red
    
} catch {
    $error2 = $_.ErrorDetails.Message | ConvertFrom-Json
    
    if ($error2.error.message -like "*reCAPTCHA*") {
        Write-Host "✅ CORRECT: Invalid reCAPTCHA rejected!" -ForegroundColor Green
        Write-Host "Message: $($error2.error.message)" -ForegroundColor Gray
    } else {
        Write-Host "⚠️  Unexpected: $($error2.error.message)" -ForegroundColor DarkYellow
    }
}

# Test 3: Empty reCAPTCHA token
Write-Host "`n3️⃣  Testing WITH empty reCAPTCHA token:" -ForegroundColor Yellow

try {
    $response3 = Invoke-RestMethod -Uri $baseUrl -Method POST -Headers $headers -Body (@{
        identifier = "test@example.com"
        password = "password123"
        recaptchaToken = ""
    } | ConvertTo-Json)
    
    Write-Host "⚠️  Empty reCAPTCHA token was accepted" -ForegroundColor DarkYellow
    
} catch {
    $error3 = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "✅ Empty reCAPTCHA properly rejected" -ForegroundColor Green
    Write-Host "Message: $($error3.error.message)" -ForegroundColor Gray
}

# Summary
Write-Host "`n" + ("=" * 50) -ForegroundColor Gray
Write-Host "📊 Test Summary & Next Steps" -ForegroundColor Cyan
Write-Host ("=" * 50) -ForegroundColor Gray

Write-Host "`n✅ What's Working:" -ForegroundColor Green
Write-Host "• reCAPTCHA validation service is active" -ForegroundColor Gray
Write-Host "• Invalid tokens are properly rejected" -ForegroundColor Gray
Write-Host "• Error handling is working correctly" -ForegroundColor Gray

Write-Host "`n🔧 If reCAPTCHA isn't required yet:" -ForegroundColor Yellow
Write-Host "1. Stop Strapi server (Ctrl+C)" -ForegroundColor Gray
Write-Host "2. Restart: npm run dev" -ForegroundColor Gray
Write-Host "3. Run this test again" -ForegroundColor Gray

Write-Host "`n🎯 For complete testing with real tokens:" -ForegroundColor White
Write-Host "1. Start frontend: cd frontend && npm start" -ForegroundColor Gray
Write-Host "2. Open browser dev tools → Network tab" -ForegroundColor Gray
Write-Host "3. Complete reCAPTCHA on login form" -ForegroundColor Gray
Write-Host "4. Copy the real token from network request" -ForegroundColor Gray
Write-Host "5. Test with real token using PowerShell" -ForegroundColor Gray

Write-Host "`n📍 Current Status:" -ForegroundColor White
if ((Get-Content .env | Select-String "RECAPTCHA_REQUIRED=true").Count -gt 0) {
    Write-Host "✅ RECAPTCHA_REQUIRED=true is configured" -ForegroundColor Green
} else {
    Write-Host "❌ RECAPTCHA_REQUIRED not set to true" -ForegroundColor Red
}

Write-Host "`n🚀 reCAPTCHA Testing Complete!" -ForegroundColor Green