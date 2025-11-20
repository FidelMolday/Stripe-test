// src/utils/pesapal.js

const axios = require("axios");

class PesapalService {
  constructor() {
    this.consumerKey =
      process.env.PESAPAL_CONSUMER_KEY ||
      "A7FT8not01x+J0HWiMoiSRhHyZlFC3D0";

    this.consumerSecret =
      process.env.PESAPAL_CONSUMER_SECRET ||
      "M6qELBp7Ic1H6BcmZD6Ewd74NgY=";

    this.environment = "production"; // you are using main URL

    this.baseUrl = "https://pay.pesapal.com/v3";

    // YOUR REGISTERED IPN ID (static)
    this.ipnId = "2a166462-698e-4fa3-8780-db119d902909";

    console.log("=== PESAPAL CONFIG ===");
    console.log("Base URL:", this.baseUrl);
    console.log("IPN ID:", this.ipnId);
    console.log("======================");
  }

  // -------------------------------
  // GET ACCESS TOKEN
  // -------------------------------
  async getAccessToken() {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/Auth/RequestToken`,
        {
          consumer_key: this.consumerKey,
          consumer_secret: this.consumerSecret,
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 10000,
        }
      );

      return response.data.token;
    } catch (error) {
      console.error("Pesapal token fetch failed:", error.response?.data);
      throw new Error("Failed to get Pesapal token");
    }
  }

  // -------------------------------
  // SUBMIT ORDER REQUEST
  // -------------------------------
  async submitOrderRequest(paymentData) {
    try {
      const token = await this.getAccessToken();

      const orderData = {
        id: paymentData.merchantReference,
        currency: paymentData.currency || "KES",
        amount: paymentData.amount,
        description: paymentData.description,
        callback_url:
          paymentData.callbackUrl ||
          "https://stripe-test-yb9k.onrender.com/api/payments/callback",

        notification_id: this.ipnId, // IMPORTANT

        billing_address: {
          email_address: paymentData.customerEmail,
          phone_number: paymentData.customerPhone || "",
          country_code: "KE",
          first_name:
            paymentData.customerName?.split(" ")[0] ||
            paymentData.customerName ||
            "",
          last_name:
            paymentData.customerName?.split(" ").slice(1).join(" ") || "",
        },
      };

      const response = await axios.post(
        `${this.baseUrl}/api/Transactions/SubmitOrderRequest`,
        orderData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );

      return response.data;
    } catch (error) {
      console.error("Submit order failed:", error.response?.data);
      throw new Error(
        error.response?.data?.message || "Failed to submit Pesapal order"
      );
    }
  }

  // -------------------------------
  // GET PAYMENT STATUS
  // -------------------------------
  async getPaymentStatus(orderTrackingId) {
    try {
      const token = await this.getAccessToken();

      const response = await axios.get(
        `${this.baseUrl}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Payment status error:", error.response?.data);
      throw new Error("Failed to fetch payment status");
    }
  }

  // -------------------------------
  // IPN VERIFICATION (Pesapal v3 ignores signature)
  // -------------------------------
  verifyIpnCallback() {
    return true; // Pesapal v3: NO SIGNATURE VALIDATION
  }
}

module.exports = new PesapalService();
