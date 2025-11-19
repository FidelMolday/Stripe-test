// test-production.js
require('dotenv').config();
const axios = require('axios');

console.log('🧪 Testing PRODUCTION Pesapal...\n');

const consumerKey = 'A7FT8not01x+J0HWiMoiSRhHyZlFC3D0';
const consumerSecret = 'M6qELBp7Ic1H6BcmZD6Ewd74NgY=';
const baseUrl = 'https://pay.pesapal.com/v3';

async function testProduction() {
  try {
    const response = await axios.post(`${baseUrl}/api/Auth/RequestToken`, {
      consumer_key: consumerKey,
      consumer_secret: consumerSecret
    });
    
    console.log('✅ PRODUCTION SUCCESS!');
    console.log('Token:', response.data.token);
    
  } catch (error) {
    console.log('❌ PRODUCTION FAILED:');
    console.log('Error:', error.response?.data);
  }
}

testProduction();