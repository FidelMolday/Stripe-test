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

  // Test Pesapal authentication
  async testPesapalAuth(req, res) {
    try {
      console.log('🧪 Testing Pesapal authentication endpoint...');
      const result = await pesapalService.testAuthentication();
      
      res.json({
        success: result.success,
        message: result.success ? "Pesapal authentication successful" : "Pesapal authentication failed",
        environment: result.environment,
        baseUrl: result.baseUrl,
        timestamp: new Date().toISOString(),
        error: result.error,
      });
    } catch (error) {
      console.error('Auth test endpoint error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Generate unique merchant reference
  generateMerchantReference() {
    const ref = `BIPS_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    console.log('📝 Generated merchant reference:', ref);
    return ref;
  }

  // Create payment request
  async createPaymentRequest(req, res) {
    try {
      const { amount, currency, customerEmail, customerName, customerPhone, description } = req.body;

      console.log('💰 CREATE PAYMENT REQUEST STARTED:', {
        amount, currency, customerEmail, customerName, customerPhone, description
      });

      // Validation
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Valid amount is required" });
      }
      if (!customerEmail || !customerName) {
        return res.status(400).json({ error: "Customer email and name are required" });
      }

      const merchantReference = this.generateMerchantReference();
      
      // Create payment record
      const paymentRecord = new Payment({
        pesapalMerchantReference: merchantReference,
        amount,
        currency: currency || "KES",
        status: "pending",
        customerEmail,
        customerName,
        customerPhone: customerPhone || "",
        description: description || `BIPS Payment - ${amount} KES`,
        callbackUrl: `${process.env.BASE_URL || 'https://stripe-test-yb9k.onrender.com'}/api/payments/callback`,
        cancellationUrl: `${process.env.BASE_URL || 'https://stripe-test-yb9k.onrender.com'}/api/payments/cancel`,
      });

      await paymentRecord.save();
      console.log('✅ Payment record saved:', paymentRecord._id);

      // Submit to Pesapal
      const pesapalResponse = await pesapalService.submitOrderRequest({
        merchantReference,
        amount,
        currency: currency || "KES",
        description: description || `BIPS Payment - ${amount} KES`,
        customerEmail,
        customerName,
        customerPhone: customerPhone || "",
        callbackUrl: paymentRecord.callbackUrl,
        cancellationUrl: paymentRecord.cancellationUrl,
      });

      console.log('✅ Pesapal response:', {
        trackingId: pesapalResponse.order_tracking_id,
        redirectUrl: pesapalResponse.redirect_url ? 'Yes' : 'No'
      });

      // Update with tracking ID
      paymentRecord.pesapalTrackingId = pesapalResponse.order_tracking_id;
      await paymentRecord.save();

      res.status(201).json({
        success: true,
        redirectUrl: pesapalResponse.redirect_url,
        merchantReference,
        pesapalTrackingId: pesapalResponse.order_tracking_id,
        amount,
        currency: currency || "KES",
        paymentRecord: {
          id: paymentRecord._id,
          status: paymentRecord.status
        }
      });

    } catch (error) {
      console.error('❌ CREATE PAYMENT REQUEST ERROR:', error);
      res.status(500).json({
        error: "Failed to create payment request",
        details: error.message,
      });
    }
  }

  // Payment callback handler
  async handleCallback(req, res) {
    try {
      const { OrderTrackingId, OrderMerchantReference, Status } = req.query;

      console.log('🔄 Payment callback received:', {
        OrderTrackingId,
        OrderMerchantReference,
        Status
      });

      // Update payment status
      if (OrderMerchantReference) {
        const paymentRecord = await Payment.findOneAndUpdate(
          { pesapalMerchantReference: OrderMerchantReference },
          {
            pesapalTrackingId: OrderTrackingId,
            status: this.mapPesapalStatus(Status)
          },
          { new: true }
        );

        if (paymentRecord) {
          console.log(`✅ Payment status updated: ${OrderMerchantReference} -> ${Status}`);
        } else {
          console.warn(`⚠️ Payment not found: ${OrderMerchantReference}`);
        }
      }

      // Redirect to frontend
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontendUrl}/payment-success?reference=${OrderMerchantReference}`);

    } catch (error) {
      console.error('❌ Callback handling error:', error);
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontendUrl}/payment-error`);
    }
  }

  // Payment cancellation handler
  async handleCancel(req, res) {
    try {
      const { OrderMerchantReference } = req.query;

      console.log('❌ Payment cancellation received:', OrderMerchantReference);

      if (OrderMerchantReference) {
        await Payment.findOneAndUpdate(
          { pesapalMerchantReference: OrderMerchantReference },
          { status: "canceled" }
        );
        console.log(`✅ Payment marked as canceled: ${OrderMerchantReference}`);
      }

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontendUrl}/payment-canceled`);

    } catch (error) {
      console.error('❌ Cancel handling error:', error);
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontendUrl}/payment-error`);
    }
  }

  // IPN handler
  async handleIpn(req, res) {
    try {
      console.log("📨 PESAPAL IPN RECEIVED:", req.body);

      const data = req.body;
      const { order_tracking_id, payment_status, payment_method, amount, currency } = data;

      if (!order_tracking_id || !payment_status) {
        console.warn("⚠️ Missing essential IPN fields");
        return res.status(200).json({ status: "success", message: "IPN received" });
      }

      // Update payment status in database
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
        console.log("✅ Payment updated in database:", updatedPayment._id);
        
        if (payment_status === 'COMPLETED') {
          console.log('🎉 Payment COMPLETED for order:', order_tracking_id);
        }
      } else {
        console.warn("⚠️ Payment not found for tracking ID:", order_tracking_id);
        
        // Create a new payment record if not found (for testing)
        if (process.env.NODE_ENV === 'development') {
          const newPayment = new Payment({
            pesapalTrackingId: order_tracking_id,
            pesapalMerchantReference: data.merchant_reference || `IPN_${order_tracking_id}`,
            amount: amount || 0,
            currency: currency || 'KES',
            status: this.mapPesapalStatus(payment_status),
            paymentMethod: payment_method,
            customerEmail: 'ipn@bips.com',
            customerName: 'IPN Customer',
            ipnReceived: true,
            ipnData: data
          });
          await newPayment.save();
          console.log('📝 Created new payment record from IPN:', newPayment._id);
        }
      }

      return res.status(200).json({
        status: "success",
        message: "IPN processed successfully"
      });
    } catch (error) {
      console.error("❌ IPN ERROR:", error);
      return res.status(200).json({
        status: "success",
        message: "IPN received (error logged)"
      });
    }
  }

  // Get payment status
  async getPaymentStatus(req, res) {
    try {
      const { merchantReference } = req.params;

      console.log('🔍 Getting payment status for:', merchantReference);

      const paymentRecord = await Payment.findOne({
        pesapalMerchantReference: merchantReference,
      });

      if (!paymentRecord) {
        console.log('❌ Payment not found:', merchantReference);
        return res.status(404).json({ error: "Payment not found" });
      }

      // Get latest status from Pesapal
      let pesapalStatus = null;
      if (paymentRecord.pesapalTrackingId) {
        try {
          pesapalStatus = await pesapalService.getPaymentStatus(paymentRecord.pesapalTrackingId);
        } catch (error) {
          console.warn('Could not fetch Pesapal status:', error.message);
        }
      }

      res.json({
        success: true,
        payment: {
          id: paymentRecord._id,
          merchantReference: paymentRecord.pesapalMerchantReference,
          trackingId: paymentRecord.pesapalTrackingId,
          amount: paymentRecord.amount,
          currency: paymentRecord.currency,
          status: paymentRecord.status,
          paymentMethod: paymentRecord.paymentMethod,
          customerEmail: paymentRecord.customerEmail,
          customerName: paymentRecord.customerName,
          description: paymentRecord.description,
          createdAt: paymentRecord.createdAt,
          updatedAt: paymentRecord.updatedAt
        },
        pesapalStatus
      });
    } catch (error) {
      console.error('❌ Get payment status error:', error);
      res.status(500).json({
        error: "Failed to get payment status",
        details: error.message,
      });
    }
  }

  // Map Pesapal status
  mapPesapalStatus(status) {
    const map = {
      'COMPLETED': 'completed',
      'FAILED': 'failed',
      'INVALID': 'failed',
      'PENDING': 'pending',
      'CANCELLED': 'canceled',
      'Completed': 'completed',
      'Failed': 'failed',
      'Pending': 'pending',
      'Canceled': 'canceled'
    };
    return map[status] || "pending";
  }
}

module.exports = new PaymentController();