require('dotenv').config();
const axios = require('axios');

console.log('🧪 Testing NEW Pesapal Credentials...\n');

const consumerKey = 'A7FT8not01x+J0HWiMoiSRhHyZlFC3D0';
const consumerSecret = 'M6qELBp7Ic1H6BcmZD6Ewd74NgY=';
const baseUrl = 'https://cybqa.pesapal.com/pesapalv3';

console.log('Consumer Key:', consumerKey);
console.log('Consumer Secret:', consumerSecret.substring(0, 10) + '...');
console.log('Base URL:', baseUrl);

async function testNewCredentials() {
  try {
    console.log('\n🔑 Requesting token with new credentials...');
    
    const response = await axios.post(`${baseUrl}/api/Auth/RequestToken`, {
      consumer_key: consumerKey,
      consumer_secret: consumerSecret
    }, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log('✅ SUCCESS!');
    console.log('Token received:', response.data.token ? 'YES 🎉' : 'NO');
    
    if (response.data.token) {
      console.log('Token (first 30 chars):', response.data.token.substring(0, 30) + '...');
      console.log('Full response:', JSON.stringify(response.data, null, 2));
    }
    
    return response.data.token;
    
  } catch (error) {
    console.log('\n❌ FAILED:');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.response?.data);
    console.log('Message:', error.message);
    return null;
  }
}

testNewCredentials().then(token => {
  if (token) {
    console.log('\n🎉 NEW CREDENTIALS WORK! Your Pesapal integration should now work!');
  } else {
    console.log('\n💥 Still having issues with the new credentials');
  }
});