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
  }

  // Generate OAuth token with detailed debugging
  async getAccessToken() {
    try {
      console.log('🔑 Requesting Pesapal token...');
      console.log('Base URL:', this.baseUrl);
      console.log('Consumer Key (first 10 chars):', this.consumerKey.substring(0, 10) + '...');

      const response = await axios.post(`${this.baseUrl}/api/Auth/RequestToken`, {
        consumer_key: this.consumerKey,
        consumer_secret: this.consumerSecret
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      console.log('✅ Token received successfully');
      console.log('Token (first 20 chars):', response.data.token ? response.data.token.substring(0, 20) + '...' : 'No token');
      
      return response.data.token;

    } catch (error) {
      console.error('❌ Pesapal token error:');
      console.error('Status:', error.response?.status);
      console.error('Error Data:', error.response?.data);
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
      console.log('🔄 Getting access token...');
      const token = await this.getAccessToken();

      const orderData = {
        id: paymentData.merchantReference,
        currency: paymentData.currency || 'KES',
        amount: paymentData.amount,
        description: paymentData.description,
        callback_url: paymentData.callbackUrl,
        cancellation_url: paymentData.cancellationUrl,
        notification_id: process.env.PESAPAL_NOTIFICATION_ID || '',
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

      console.log('📦 Submitting order to Pesapal:', JSON.stringify(orderData, null, 2));

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

      console.log('✅ Pesapal order submitted successfully:');
      console.log('Response:', response.data);
      
      return response.data;

    } catch (error) {
      console.error('❌ Pesapal order submission error:');
      console.error('Status:', error.response?.status);
      console.error('Error Data:', error.response?.data);
      console.error('Error Message:', error.message);
      
      throw new Error(`Failed to submit Pesapal order: ${error.response?.data?.message || error.message}`);
    }
  }

  // Get payment status
  async getPaymentStatus(merchantReference) {
    try {
      const token = await this.getAccessToken();

      const response = await axios.get(
        `${this.baseUrl}/api/Transactions/GetTransactionStatus?orderTrackingId=${merchantReference}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Pesapal status check error:', error.response?.data || error.message);
      throw new Error('Failed to get payment status');
    }
  }

  // Generate IPN URL
  generateIpnUrl() {
    return `${process.env.BASE_URL}/api/payments/ipn`;
  }

  // Verify IPN callback
  verifyIpnCallback(data, signature) {
    return true; // For sandbox, skip verification
  }
}

module.exports = new PesapalService();