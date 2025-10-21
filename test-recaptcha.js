const axios = require('axios');

/**
 * Test reCAPTCHA configuration
 * This script helps verify if your reCAPTCHA keys are properly configured
 */

// Test configuration
const SITE_KEY = '6Ld_GM8rAAAAAK_dyi6p7ndKZKG1kaWqJwupvEJn';
const SECRET_KEY = 'your-actual-secret-key-here'; // This needs to be replaced with real secret
const TEST_TOKEN = 'test-token'; // This would normally come from frontend

async function testRecaptchaConfiguration() {
  console.log('🧪 Testing reCAPTCHA Configuration...\n');
  
  // Check if secret key is configured
  if (SECRET_KEY === 'your-actual-secret-key-here') {
    console.log('❌ SECRET KEY ISSUE:');
    console.log('   Your backend .env still has the placeholder secret key.');
    console.log('   You need to replace it with the real secret key from Google reCAPTCHA Console.\n');
    
    console.log('📋 TO FIX THIS:');
    console.log('1. Go to https://www.google.com/recaptcha/admin');
    console.log('2. Select your site or create a new one');
    console.log('3. Copy the SECRET KEY');
    console.log('4. Replace "your-actual-secret-key-here" in your backend .env file');
    console.log('5. Restart your Strapi server\n');
    return;
  }
  
  // Test with Google's verification API
  try {
    console.log('🔍 Testing connection to Google reCAPTCHA API...');
    
    const requestData = {
      secret: SECRET_KEY,
      response: TEST_TOKEN, // This will fail but shows us the error
    };
    
    const response = await axios({
      method: 'POST',
      url: 'https://www.google.com/recaptcha/api/siteverify',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: new URLSearchParams(requestData).toString(),
      timeout: 10000,
    });
    
    console.log('📊 Google Response:', response.data);
    
    if (response.data.success) {
      console.log('✅ reCAPTCHA configuration is working!');
    } else {
      console.log('❌ reCAPTCHA verification failed');
      console.log('   Error codes:', response.data['error-codes'] || 'none');
      
      const errorCodes = response.data['error-codes'] || [];
      
      if (errorCodes.includes('invalid-input-secret')) {
        console.log('   → Your secret key is invalid or doesn\'t match the site key');
      }
      if (errorCodes.includes('invalid-input-response')) {
        console.log('   → This is expected with test token - your keys are probably correct');
      }
      if (errorCodes.includes('timeout-or-duplicate')) {
        console.log('   → Token expired or already used');
      }
    }
    
  } catch (error) {
    console.log('❌ Network Error:', error.message);
    console.log('   Make sure your server can reach https://www.google.com');
  }
}

// Run the test
testRecaptchaConfiguration();