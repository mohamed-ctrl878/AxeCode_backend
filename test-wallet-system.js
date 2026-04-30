const axios = require('axios');
const jwt = require('jsonwebtoken');

const API_URL = 'http://localhost:1338/api';
const JWT_SECRET = 'SGmtLD+yGYH1SF2OPNTXBg==';

// Assuming we use testuser (id: 24)
const USER_ID = 24; 
// We create a token exactly like Strapi does: { id: userId }
const jwtToken = jwt.sign({ id: USER_ID }, JWT_SECRET, { expiresIn: '30d' });

let targetCourseId = 'cp9en0jmkfeo8wtzmd6n1uts'; // from our previous query
let pendingPaymentOrderId = '';

async function runTests() {
  console.log('--- STARTING WALLET & PAYMENT E2E TESTS (Using User 24) ---');
  console.log('JWT Token:', jwtToken);

  try {
    // 3. Check Wallet (should create one)
    console.log('\n[1] Fetching User Wallet...');
    const walletRes = await axios.get(`${API_URL}/wallet/me`, {
      headers: { Authorization: `Bearer ${jwtToken}` }
    });
    console.log(`✅ Wallet retrieved. Balance: ${walletRes.data.data.balance} ${walletRes.data.data.currency}`);

    // 4. Initiate Payment
    console.log(`\n[2] Initiating payment for course ${targetCourseId}...`);
    try {
      const initRes = await axios.post(`${API_URL}/payments/initiate`, {
        itemId: targetCourseId,
        contentType: 'course'
      }, {
        headers: { Authorization: `Bearer ${jwtToken}` }
      });
      
      pendingPaymentOrderId = initRes.data.data.order_id;
      console.log(`✅ Payment initiated. Paymob Order ID: ${pendingPaymentOrderId}`);
      console.log(`   Iframe URL: ${initRes.data.data.iframe_url}`);
    } catch (err) {
      console.error('❌ Failed to initiate payment:', err.response?.data || err.message);
      if (err.response?.data?.error?.message?.includes('already have access')) {
         console.log('Skipping initiation, creating a fake order ID for webhook test');
         pendingPaymentOrderId = 'TEST_ORDER_' + Date.now();
      } else {
         return; // Stop if initiation fails for other reasons
      }
    }

    // 5. Simulate Webhook
    console.log('\n[3] Simulating successful Paymob webhook...');
    const webhookPayload = {
      type: 'TRANSACTION',
      obj: {
        id: Math.floor(Math.random() * 100000000), // Random Paymob transaction ID
        pending: false,
        amount_cents: 50000, 
        success: true,
        is_auth: false,
        is_capture: false,
        is_standalone_payment: true,
        is_voided: false,
        is_refunded: false,
        is_3d_secure: true,
        integration_id: 12345,
        profile_id: 6789,
        has_parent_transaction: false,
        order: {
          id: pendingPaymentOrderId // Important: Must match the order we just created
        },
        created_at: new Date().toISOString(),
        currency: 'EGP',
        source_data: {
          type: 'card',
          sub_type: 'MasterCard',
          pan: '512345xxxxxx2346'
        },
        owner: 6789,
        error_occured: false
      }
    };

    const dummyHmac = 'simulated_hmac_string';

    try {
      const webhookRes = await axios.post(`${API_URL}/payments/webhook?hmac=${dummyHmac}`, webhookPayload);
      console.log('✅ Webhook processed successfully. Response:', webhookRes.data);
    } catch (err) {
      console.error('❌ Webhook failed:', err.response?.data || err.message);
    }

    // 6. Check Wallet Balance again
    console.log('\n[4] Re-fetching User Wallet...');
    const walletRes2 = await axios.get(`${API_URL}/wallet/me`, {
      headers: { Authorization: `Bearer ${jwtToken}` }
    });
    console.log(`✅ Wallet retrieved. New Balance: ${walletRes2.data.data.balance} ${walletRes2.data.data.currency}`);
    console.log(`   Transactions count: ${walletRes2.data.data.transactions?.length || 0}`);
    
    // 7. Request Payout
    console.log('\n[5] Requesting Payout of 150 EGP...');
    try {
      const payoutRes = await axios.post(`${API_URL}/payouts/request`, {
        amount: 150,
        method: "InstaPay",
        details: { instapay_handle: "testuser@instapay" }
      }, {
        headers: { Authorization: `Bearer ${jwtToken}` }
      });
      console.log('✅ Payout successful. Remaining balance:', payoutRes.data.data.wallet?.balance || 'updated');
    } catch (err) {
       console.error('❌ Payout failed:', err.response?.data?.error?.message || err.message);
    }

  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:');
    console.error(error.response ? error.response.data : error.message);
  }
}

runTests();
