# Debug reCAPTCHA Validation
# This script helps debug why reCAPTCHA might not be rejecting invalid tokens

Write-Host "🐛 reCAPTCHA Debug Testing" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Gray

$baseUrl = "http://localhost:1338/api/auth/login"
$headers = @{"Content-Type" = "application/json"}

Write-Host "`n📋 Environment Check:" -ForegroundColor White
Write-Host "RECAPTCHA_SECRET_KEY: $(if ((Get-Content .env | Select-String 'RECAPTCHA_SECRET_KEY').Count -gt 0) { '✅ Set' } else { '❌ Missing' })" -ForegroundColor Gray
Write-Host "RECAPTCHA_REQUIRED: $(if ((Get-Content .env | Select-String 'RECAPTCHA_REQUIRED=true').Count -gt 0) { '✅ true' } else { '❌ Not true' })" -ForegroundColor Gray

Write-Host "`n🧪 Test Scenarios:" -ForegroundColor White

# Test 1: With a clearly invalid reCAPTCHA token
Write-Host "`n1️⃣  Invalid reCAPTCHA Token Test:" -ForegroundColor Yellow
Write-Host "Expected: Should fail with 'reCAPTCHA verification failed'" -ForegroundColor Gray

$testData1 = @{
    identifier = "nonexistent@test.com"
    password = "wrongpassword"
    recaptchaToken = "CLEARLY_INVALID_TOKEN_12345"
} | ConvertTo-Json

Write-Host "Sending: $testData1" -ForegroundColor DarkGray

try {
    $response1 = Invoke-RestMethod -Uri $baseUrl -Method POST -Headers $headers -Body $testData1 -ErrorAction Stop
    Write-Host "❌ PROBLEM: Request succeeded when it should have failed!" -ForegroundColor Red
    Write-Host "Response: $($response1 | ConvertTo-Json)" -ForegroundColor Red
} catch {
    $error1 = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "Status Code: $($error1.error.status)" -ForegroundColor White
    Write-Host "Error Message: $($error1.error.message)" -ForegroundColor White
    
    if ($error1.error.details.error -eq "recaptcha_failed") {
        Write-Host "✅ CORRECT: reCAPTCHA properly rejected!" -ForegroundColor Green
    } elseif ($error1.error.message -eq "User not found") {
        Write-Host "⚠️  WARNING: Got 'User not found' instead of reCAPTCHA error" -ForegroundColor DarkYellow
        Write-Host "This means reCAPTCHA validation passed when it shouldn't have!" -ForegroundColor DarkYellow
    } else {
        Write-Host "ℹ️  Unexpected error: $($error1.error.message)" -ForegroundColor Blue
    }
}

# Test 2: Without reCAPTCHA token (to check if it's required)
Write-Host "`n2️⃣  No reCAPTCHA Token Test:" -ForegroundColor Yellow
Write-Host "Expected: Should fail with 'reCAPTCHA verification is required'" -ForegroundColor Gray

$testData2 = @{
    identifier = "test@example.com"
    password = "password123"
} | ConvertTo-Json

try {
    $response2 = Invoke-RestMethod -Uri $baseUrl -Method POST -Headers $headers -Body $testData2 -ErrorAction Stop
    Write-Host "❌ PROBLEM: Login succeeded without reCAPTCHA!" -ForegroundColor Red
    Write-Host "This means RECAPTCHA_REQUIRED=true is not working" -ForegroundColor Red
} catch {
    $error2 = $_.ErrorDetails.Message | ConvertFrom-Json
    
    if ($error2.error.details.error -eq "recaptcha_missing") {
        Write-Host "✅ CORRECT: reCAPTCHA is required!" -ForegroundColor Green
    } else {
        Write-Host "ℹ️  Got: $($error2.error.message)" -ForegroundColor Blue
        Write-Host "This suggests reCAPTCHA requirement may not be active" -ForegroundColor Gray
    }
}

Write-Host "`n📊 Analysis:" -ForegroundColor White
Write-Host "============" -ForegroundColor Gray

Write-Host "`n🔧 If reCAPTCHA validation is not working:" -ForegroundColor Yellow
Write-Host "1. Check that Strapi server was restarted after .env changes" -ForegroundColor Gray
Write-Host "2. Verify the secret key is valid for the site key" -ForegroundColor Gray
Write-Host "3. Check server logs for reCAPTCHA service errors" -ForegroundColor Gray
Write-Host "4. Ensure internet connection for Google API calls" -ForegroundColor Gray

Write-Host "`n💡 Next Steps:" -ForegroundColor White
Write-Host "1. Restart Strapi: npm run dev" -ForegroundColor Gray
Write-Host "2. Watch server logs when testing" -ForegroundColor Gray
Write-Host "3. Check if you see the English log messages:" -ForegroundColor Gray
Write-Host "   - 'Login rejected: reCAPTCHA verification failed'" -ForegroundColor Gray
Write-Host "   - 'reCAPTCHA verification successful'" -ForegroundColor Gray

Write-Host "`n🚀 Debug Test Complete!" -ForegroundColor Green