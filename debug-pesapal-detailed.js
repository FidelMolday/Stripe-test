require('dotenv').config();
const axios = require('axios');

console.log('🔍 Detailed Pesapal API Debug...\n');

const consumerKey = 'A7FT8not01x+J0HWiMoiSRhHyZlFC3D0';
const consumerSecret = 'M6qELBp7Ic1H6BcmZD6Ewd74NgY=';
const baseUrl = 'https://cybqa.pesapal.com/pesapalv3';

async function debugDetailed() {
  try {
    console.log('📤 Sending request to:', `${baseUrl}/api/Auth/RequestToken`);
    console.log('📝 Payload:', {
      consumer_key: consumerKey,
      consumer_secret: consumerSecret
    });
    
    const response = await axios.post(`${baseUrl}/api/Auth/RequestToken`, {
      consumer_key: consumerKey,
      consumer_secret: consumerSecret
    }, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      // Add this to see raw response
      transformResponse: [function (data) {
        console.log('📥 Raw response data:', data);
        return data;
      }]
    });
    
    console.log('\n📊 Response Analysis:');
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('Headers:', JSON.stringify(response.headers, null, 2));
    console.log('Data Type:', typeof response.data);
    console.log('Data:', response.data);
    console.log('Data Keys:', Object.keys(response.data));
    
    if (response.data && typeof response.data === 'object') {
      console.log('All properties:');
      for (let key in response.data) {
        console.log(`  ${key}:`, response.data[key]);
      }
    }
    
  } catch (error) {
    console.log('\n❌ Error Details:');
    console.log('Message:', error.message);
    console.log('Code:', error.code);
    console.log('Status:', error.response?.status);
    console.log('Status Text:', error.response?.statusText);
    console.log('Response Data:', error.response?.data);
    console.log('Response Headers:', error.response?.headers);
  }
}

debugDetailed();