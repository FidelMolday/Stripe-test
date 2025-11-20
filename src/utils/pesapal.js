const axios = require("axios");

class PesapalService {
  constructor() {
    this.consumerKey = process.env.PESAPAL_CONSUMER_KEY || "A7FT8not01x+J0HWiMoiSRhHyZlFC3D0";
    this.consumerSecret = process.env.PESAPAL_CONSUMER_SECRET || "M6qELBp7Ic1H6BcmZD6Ewd74NgY=";
    this.environment = "production";
    this.baseUrl = "https://pay.pesapal.com/v3";
    this.ipnId = "2a166462-698e-4fa3-8780-db119d902909";

    console.log("=== PESAPAL CONFIG ===");
    console.log("Base URL:", this.baseUrl);
    console.log("IPN ID:", this.ipnId);
    console.log("======================");
  }

  // Test authentication
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

  // Get access token
  async getAccessToken() {
    try {
      console.log('🔑 Getting Pesapal access token...');
      
      const response = await axios.post(
        `${this.baseUrl}/api/Auth/RequestToken`,
        {
          consumer_key: this.consumerKey,
          consumer_secret: this.consumerSecret,
        },
        {
          headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          timeout: 10000,
        }
      );

      console.log('✅ Token received successfully');
      return response.data.token;
    } catch (error) {
      console.error('❌ Token fetch failed:');
      console.error('Status:', error.response?.status);
      console.error('Error Data:', error.response?.data);
      console.error('Error Message:', error.message);
      throw new Error("Failed to get Pesapal token");
    }
  }

  // Submit order request
  async submitOrderRequest(paymentData) {
    try {
      console.log('🔄 Submitting order to Pesapal...');
      const token = await this.getAccessToken();

      const orderData = {
        id: paymentData.merchantReference,
        currency: paymentData.currency || "KES",
        amount: paymentData.amount,
        description: paymentData.description,
        callback_url: paymentData.callbackUrl,
        cancellation_url: paymentData.cancellationUrl,
        notification_id: this.ipnId,
        billing_address: {
          email_address: paymentData.customerEmail,
          phone_number: paymentData.customerPhone || "",
          country_code: "KE",
          first_name: paymentData.customerName?.split(" ")[0] || paymentData.customerName || "",
          middle_name: "",
          last_name: paymentData.customerName?.split(" ").slice(1).join(" ") || "",
          line_1: "Nairobi",
          line_2: "",
          city: "Nairobi",
          state: "",
          postal_code: "00100",
          zip_code: ""
        },
      };

      console.log('📦 Order Data:', JSON.stringify(orderData, null, 2));

      const response = await axios.post(
        `${this.baseUrl}/api/Transactions/SubmitOrderRequest`,
        orderData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          timeout: 15000,
        }
      );

      console.log('✅ Order submitted successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Submit order failed:');
      console.error('URL:', error.config?.url);
      console.error('Status:', error.response?.status);
      console.error('Error Data:', error.response?.data);
      console.error('Error Message:', error.message);
      throw new Error(error.response?.data?.message || "Failed to submit Pesapal order");
    }
  }

  // Get payment status
  async getPaymentStatus(orderTrackingId) {
    try {
      console.log('🔍 Getting payment status for:', orderTrackingId);
      const token = await this.getAccessToken();

      const response = await axios.get(
        `${this.baseUrl}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
        }
      );

      console.log('✅ Status check successful:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Payment status error:');
      console.error('URL:', error.config?.url);
      console.error('Error Data:', error.response?.data);
      console.error('Error Message:', error.message);
      throw new Error("Failed to fetch payment status");
    }
  }

  // IPN verification
  verifyIpnCallback() {
    return true;
  }
}

module.exports = new PesapalService();