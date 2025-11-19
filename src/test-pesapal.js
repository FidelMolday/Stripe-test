require('dotenv').config();

async function testPesapalConnection() {
  console.log('🧪 Testing Pesapal API Connection...\n');
  
  const consumerKey = process.env.PESAPAL_CONSUMER_KEY;
  const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET;
  const environment = process.env.PESAPAL_ENV;
  
  console.log('Environment:', environment);
  console.log('Consumer Key:', consumerKey ? consumerKey.substring(0, 10) + '...' : 'Not set');
  console.log('Consumer Secret:', consumerSecret ? consumerSecret.substring(0, 10) + '...' : 'Not set');
  
  const baseUrl = environment === 'production' 
    ? 'https://pay.pesapal.com/v3'
    : 'https://cybqa.pesapal.com/pesapalv3';
  
  console.log('Base URL:', baseUrl);
  
  try {
    const axios = require('axios');
    
    console.log('\n🔑 Step 1: Testing token request...');
    const tokenResponse = await axios.post(`${baseUrl}/api/Auth/RequestToken`, {
      consumer_key: consumerKey,
      consumer_secret: consumerSecret
    }, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log('✅ Token request SUCCESS!');
    console.log('Token received:', tokenResponse.data.token ? 'Yes' : 'No');
    
    if (tokenResponse.data.token) {
      console.log('Token (first 30 chars):', tokenResponse.data.token.substring(0, 30) + '...');
    }
    
    return true;
    
  } catch (error) {
    console.log('\n❌ Token request FAILED:');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.response?.data);
    console.log('Message:', error.message);
    
    return false;
  }
}

testPesapalConnection().then(success => {
  console.log('\n' + (success ? '🎉 All tests passed!' : '💥 Tests failed'));
  process.exit(success ? 0 : 1);
});