// src/controllers/paymentController.js

const pesapalService = require("../utils/pesapal");
const Payment = require("../models/Payment");

class PaymentController {
  constructor() {
    this.createPaymentRequest = this.createPaymentRequest.bind(this);
    this.handleCallback = this.handleCallback.bind(this);
    this.handleCancel = this.handleCancel.bind(this);
    this.handleIpn = this.handleIpn.bind(this);
    this.getPaymentStatus = this.getPaymentStatus.bind(this);
    this.testPesapalAuth = this.testPesapalAuth.bind(this);
  }

  // --------------------------------------------------
  // TEST PESAPAL AUTHENTICATION
  // --------------------------------------------------
  async testPesapalAuth(req, res) {
    try {
      const result = await pesapalService.testAuthentication();

      res.json({
        success: result.success,
        message: result.success
          ? "Pesapal authentication successful"
          : "Pesapal authentication failed",
        environment: result.environment,
        baseUrl: result.baseUrl,
        timestamp: new Date().toISOString(),
        error: result.error,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // --------------------------------------------------
  // GENERATE UNIQUE MERCHANT REFERENCE
  // --------------------------------------------------
  generateMerchantReference() {
    return `BIPS_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;
  }

  // --------------------------------------------------
  // CREATE PAYMENT REQUEST (STEP 1)
  // --------------------------------------------------
  async createPaymentRequest(req, res) {
    try {
      const {
        amount,
        currency,
        customerEmail,
        customerName,
        customerPhone,
        description,
      } = req.body;

      if (!amount || !customerEmail || !customerName) {
        return res
          .status(400)
          .json({ error: "Amount, email and name are required" });
      }

      const merchantReference = this.generateMerchantReference();

      const paymentRecord = await Payment.create({
        pesapalMerchantReference: merchantReference,
        amount,
        currency: currency || "KES",
        status: "pending",
        customerEmail,
        customerName,
        customerPhone: customerPhone || "",
        description: description || `BIPS Payment - ${amount} KES`,
        callbackUrl:
          `${process.env.BASE_URL}/api/payments/callback` ||
          "http://localhost:3001/api/payments/callback",
        cancellationUrl:
          `${process.env.BASE_URL}/api/payments/cancel` ||
          "http://localhost:3001/api/payments/cancel",
      });

      // Submit to Pesapal
      const pesapalResponse = await pesapalService.submitOrderRequest({
        merchantReference,
        amount,
        currency,
        description,
        customerEmail,
        customerName,
        customerPhone,
        callbackUrl: paymentRecord.callbackUrl,
        cancellationUrl: paymentRecord.cancellationUrl,
      });

      // Save tracking ID
      paymentRecord.pesapalTrackingId = pesapalResponse.order_tracking_id;
      await paymentRecord.save();

      res.status(201).json({
        success: true,
        redirectUrl: pesapalResponse.redirect_url,
        merchantReference,
        pesapalTrackingId: pesapalResponse.order_tracking_id,
      });
    } catch (error) {
      console.error("CREATE PAYMENT REQUEST ERROR:", error);
      res.status(500).json({
        error: "Failed to create payment request",
        details: error.message,
      });
    }
  }

  // --------------------------------------------------
  // CALLBACK (User Returning From Pesapal)
  // --------------------------------------------------
  async handleCallback(req, res) {
    try {
      const { OrderTrackingId, OrderMerchantReference, Status } = req.query;

      if (OrderMerchantReference) {
        await Payment.findOneAndUpdate(
          { pesapalMerchantReference: OrderMerchantReference },
          {
            pesapalTrackingId: OrderTrackingId,
            status: this.mapPesapalStatus(Status),
          }
        );
      }

      const frontend = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(
        `${frontend}/payment-success?reference=${OrderMerchantReference}`
      );
    } catch (error) {
      const frontend = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontend}/payment-error`);
    }
  }

  // --------------------------------------------------
  // PAYMENT CANCELLATION
  // --------------------------------------------------
  async handleCancel(req, res) {
    try {
      const { OrderMerchantReference } = req.query;

      if (OrderMerchantReference) {
        await Payment.findOneAndUpdate(
          { pesapalMerchantReference: OrderMerchantReference },
          { status: "canceled" }
        );
      }

      const frontend = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontend}/payment-canceled`);
    } catch (error) {
      const frontend = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontend}/payment-error`);
    }
  }

  // --------------------------------------------------
  // IPN (Instant Payment Notification) – Pesapal Server to Server
  // --------------------------------------------------
  async handleIpn(req, res) {
    try {
      console.log("📨 PESAPAL IPN RECEIVED:", req.body);

      const data = req.body;

      // Mandatory fields from Pesapal v3
      const {
        merchant_reference,
        order_tracking_id,
        payment_status,
        payment_method,
        amount,
        currency,
      } = data;

      if (!order_tracking_id || !payment_status) {
        console.warn("⚠️ Missing essential IPN fields");
        return res.status(200).json({ status: "success" });
      }

      const updatedPayment = await Payment.findOneAndUpdate(
        { pesapalTrackingId: order_tracking_id },
        {
          status: this.mapPesapalStatus(payment_status),
          paymentMethod: payment_method,
          ipnReceived: true,
          ipnData: data,
          updatedAt: new Date(),
        },
        { new: true }
      );

      if (updatedPayment) {
        console.log("✅ Payment updated:", updatedPayment._id);
      } else {
        console.warn(
          "⚠️ Payment not found for tracking ID:",
          order_tracking_id
        );
      }

      // MUST ALWAYS RETURN 200 SUCCESS
      return res.status(200).json({
        status: "success",
        message: "IPN processed",
      });
    } catch (error) {
      console.error("IPN ERROR:", error);

      // STILL RETURN 200 SUCCESS
      return res.status(200).json({
        status: "success",
        error: "Logged internally",
      });
    }
  }

  // --------------------------------------------------
  // GET PAYMENT STATUS
  // --------------------------------------------------
  async getPaymentStatus(req, res) {
    try {
      const { merchantReference } = req.params;

      const paymentRecord = await Payment.findOne({
        pesapalMerchantReference: merchantReference,
      });

      if (!paymentRecord) {
        return res.status(404).json({ error: "Payment not found" });
      }

      const pesapalStatus = await pesapalService.getPaymentStatus(
        paymentRecord.pesapalTrackingId
      );

      res.json({
        success: true,
        payment: paymentRecord,
        pesapalStatus,
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to fetch status",
        details: error.message,
      });
    }
  }

  // --------------------------------------------------
  // MAP PESAPAL STATUS (v3)
  // --------------------------------------------------
  mapPesapalStatus(status) {
    const map = {
      COMPLETED: "completed",
      FAILED: "failed",
      INVALID: "failed",
      PENDING: "pending",
      CANCELLED: "canceled",
    };

    return map[status?.toUpperCase()] || "pending";
  }
}

module.exports = new PaymentController();
