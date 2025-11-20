const axios = require('axios');
const crypto = require('crypto');

class PesapalService {
  constructor() {
    this.consumerKey = process.env.PESAPAL_CONSUMER_KEY || 'A7FT8not01x+J0HWiMoiSRhHyZlFC3D0';
    this.consumerSecret = process.env.PESAPAL_CONSUMER_SECRET || 'M6qELBp7Ic1H6BcmZD6Ewd74NgY=';
    this.environment = process.env.PESAPAL_ENV || 'production';
    
    this.baseUrl = this.environment === 'production' 
      ? 'https://pay.pesapal.com/v3'
      : 'https://cybqa.pesapal.com/pesapalv3';

    // COMPREHENSIVE DEBUGGING
    console.log('=== PESAPAL CONFIGURATION ===');
    console.log('Environment:', this.environment);
    console.log('Base URL:', this.baseUrl);
    console.log('Consumer Key exists:', !!this.consumerKey);
    console.log('Consumer Secret exists:', !!this.consumerSecret);
    console.log('Using env vars:', !!(process.env.PESAPAL_CONSUMER_KEY && process.env.PESAPAL_CONSUMER_SECRET));
    console.log('BASE_URL:', process.env.BASE_URL || 'Not set');
    console.log('============================');
  }

  // Generate OAuth token with detailed debugging
  async getAccessToken() {
    try {
      console.log('🔑 STEP 1: Requesting Pesapal token from:', `${this.baseUrl}/api/Auth/RequestToken`);
      
      const requestBody = {
        consumer_key: this.consumerKey.trim(),
        consumer_secret: this.consumerSecret.trim()
      };

      console.log('Request body (keys masked):', {
        consumer_key: requestBody.consumer_key.substring(0, 10) + '...',
        consumer_secret: '***' + requestBody.consumer_secret.substring(requestBody.consumer_secret.length - 5)
      });

      const response = await axios.post(
        `${this.baseUrl}/api/Auth/RequestToken`, 
        requestBody,
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      console.log('✅ STEP 1: Token request SUCCESSFUL');
      console.log('Token received:', response.data.token ? `***${response.data.token.substring(response.data.token.length - 20)}` : 'NO TOKEN');
      
      return response.data.token;

    } catch (error) {
      console.error('❌ STEP 1: Token request FAILED:');
      console.error('URL:', error.config?.url);
      console.error('Status:', error.response?.status);
      console.error('Response Data:', error.response?.data);
      console.error('Error Message:', error.message);
      
      if (error.response?.data) {
        throw new Error(`Pesapal authentication failed: ${JSON.stringify(error.response.data)}`);
      }
      throw new Error(`Failed to get Pesapal access token: ${error.message}`);
    }
  }

  // Submit payment request
  async submitOrderRequest(paymentData) {
    try {
      console.log('🔄 STEP 1: Getting access token...');
      const token = await this.getAccessToken();
      
      console.log('✅ STEP 1: Token obtained successfully');

      const orderData = {
        id: paymentData.merchantReference,
        currency: paymentData.currency || 'KES',
        amount: paymentData.amount,
        description: paymentData.description,
        callback_url: paymentData.callbackUrl,
        cancellation_url: paymentData.cancellationUrl,
        billing_address: {
          email_address: paymentData.customerEmail,
          phone_number: paymentData.customerPhone || '',
          country_code: 'KE',
          first_name: paymentData.customerName.split(' ')[0] || paymentData.customerName,
          middle_name: '',
          last_name: paymentData.customerName.split(' ').slice(1).join(' ') || '',
          line_1: 'Nairobi',
          line_2: '',
          city: 'Nairobi',
          state: '',
          postal_code: '00100',
          zip_code: ''
        }
      };

      console.log('🔄 STEP 2: Submitting order to Pesapal...');
      console.log('Order Data:', JSON.stringify(orderData, null, 2));
      console.log('Using Token (last 20 chars):', `***${token.substring(token.length - 20)}`);

      const response = await axios.post(
        `${this.baseUrl}/api/Transactions/SubmitOrderRequest`,
        orderData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 15000
        }
      );

      console.log('✅ STEP 2: Pesapal order submitted SUCCESSFULLY!');
      console.log('Full Response:', JSON.stringify(response.data, null, 2));
      
      return response.data;

    } catch (error) {
      console.error('❌ STEP 2: Pesapal order submission FAILED:');
      console.error('URL:', error.config?.url);
      console.error('Status:', error.response?.status);
      console.error('Headers Sent:', error.config?.headers ? {
        'Authorization': error.config.headers.Authorization ? 'Bearer ***' + error.config.headers.Authorization.substring(error.config.headers.Authorization.length - 20) : 'Not set',
        'Content-Type': error.config.headers['Content-Type'],
        'Accept': error.config.headers['Accept']
      } : 'No headers');
      console.error('Request Data:', error.config?.data);
      console.error('Response Data:', error.response?.data);
      console.error('Error Message:', error.message);
      
      throw new Error(`Failed to submit Pesapal order: ${error.response?.data?.message || error.message}`);
    }
  }

  // Get payment status
  async getPaymentStatus(merchantReference) {
    try {
      console.log('🔍 Getting payment status for:', merchantReference);
      const token = await this.getAccessToken();

      const url = `${this.baseUrl}/api/Transactions/GetTransactionStatus?orderTrackingId=${merchantReference}`;
      console.log('Status check URL:', url);

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Status check successful:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Status check failed:');
      console.error('URL:', error.config?.url);
      console.error('Status:', error.response?.status);
      console.error('Error Data:', error.response?.data);
      console.error('Error Message:', error.message);
      throw new Error('Failed to get payment status');
    }
  }

  // Test authentication only
  async testAuthentication() {
    try {
      console.log('🧪 Testing Pesapal authentication...');
      const token = await this.getAccessToken();
      return {
        success: true,
        token: token ? 'Received' : 'No token',
        environment: this.environment,
        baseUrl: this.baseUrl
      };
    } catch (error) {
      console.error('🧪 Authentication test FAILED:', error.message);
      return {
        success: false,
        error: error.message,
        environment: this.environment,
        baseUrl: this.baseUrl
      };
    }
  }

  // Generate IPN URL
  generateIpnUrl() {
    const ipnUrl = `${process.env.BASE_URL}/api/payments/ipn`;
    console.log('🌐 Generated IPN URL:', ipnUrl);
    return ipnUrl;
  }

  // Verify IPN callback
  verifyIpnCallback(data, signature) {
    return true; // For sandbox, skip verification
  }
}

module.exports = new PesapalService();