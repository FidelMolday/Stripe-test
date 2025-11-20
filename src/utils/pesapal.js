const axios = require("axios");

class PesapalService {
  constructor() {
    this.consumerKey = process.env.PESAPAL_CONSUMER_KEY || "A7FT8not01x+J0HWiMoiSRhHyZlFC3D0";
    this.consumerSecret = process.env.PESAPAL_CONSUMER_SECRET || "M6qELBp7Ic1H6BcmZD6Ewd74NgY=";
    this.environment = "production";
    this.baseUrl = "https://pay.pesapal.com/v3";
    this.ipnId = process.env.PESAPAL_IPN_ID || "baae690a-55e1-4b56-844c-db114bb6c750"; // FROM ENV
    
    this.currentToken = null;
    this.tokenExpiry = null;

    console.log("=== PESAPAL CONFIG ===");
    console.log("Base URL:", this.baseUrl);
    console.log("IPN ID:", this.ipnId);
    console.log("Using IPN from ENV:", !!process.env.PESAPAL_IPN_ID);
    console.log("======================");
  }

  // Get access token
  async getAccessToken() {
    if (this.currentToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      console.log('🔑 Using cached token');
      return this.currentToken;
    }

    try {
      console.log('🔑 Getting new Pesapal access token...');
      
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

      this.currentToken = response.data.token;
      this.tokenExpiry = Date.now() + (4 * 60 * 1000);
      
      console.log('✅ New token received successfully');
      return this.currentToken;
    } catch (error) {
      console.error('❌ Token fetch failed:');
      console.error('Status:', error.response?.status);
      console.error('Error Data:', error.response?.data);
      console.error('Error Message:', error.message);
      throw new Error("Failed to get Pesapal token");
    }
  }

  clearTokenCache() {
    this.currentToken = null;
    this.tokenExpiry = null;
    console.log('🔄 Token cache cleared');
  }

  async testAuthentication() {
    try {
      console.log('🧪 Testing Pesapal authentication...');
      const token = await this.getAccessToken();
      return {
        success: true,
        token: token ? 'Received' : 'No token',
        environment: this.environment,
        baseUrl: this.baseUrl,
        ipnId: this.ipnId
      };
    } catch (error) {
      console.error('🧪 Authentication test FAILED:', error.message);
      return {
        success: false,
        error: error.message,
        environment: this.environment,
        baseUrl: this.baseUrl,
        ipnId: this.ipnId
      };
    }
  }

  // Submit order request
  async submitOrderRequest(paymentData) {
    try {
      console.log('🔄 Submitting order to Pesapal...');
      const token = await this.getAccessToken();

      // Validate IPN ID
      if (!this.ipnId) {
        throw new Error("IPN ID is not configured. Please set PESAPAL_IPN_ID environment variable.");
      }

      const orderData = {
        id: paymentData.merchantReference,
        currency: paymentData.currency || "KES",
        amount: paymentData.amount,
        description: paymentData.description,
        callback_url: paymentData.callbackUrl,
        cancellation_url: paymentData.cancellationUrl,
        notification_id: this.ipnId, // Using IPN ID from env
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
      console.log('🔑 Using IPN ID:', this.ipnId);

      const response = await axios.post(
        `${this.baseUrl}/api/Transactions/SubmitOrderRequest`,
        orderData,
        {
          headers: {
            "Authorization": `Bearer ${token}`,
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
      
      if (error.response?.status === 500 && error.response?.data?.error?.code === 'invalid_api_credentials_provided') {
        console.log('🔄 Clearing token cache due to auth error');
        this.clearTokenCache();
      }
      
      throw new Error(error.response?.data?.message || "Failed to submit Pesapal order");
    }
  }

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

  verifyIpnCallback() {
    return true;
  }
}

module.exports = new PesapalService();