const pesapalService = require('../utils/pesapal');
const Payment = require('../models/Payment');

class PaymentController {
  constructor() {
    // Bind methods to ensure 'this' context is preserved
    this.createPaymentRequest = this.createPaymentRequest.bind(this);
    this.handleCallback = this.handleCallback.bind(this);
    this.handleCancel = this.handleCancel.bind(this);
    this.handleIpn = this.handleIpn.bind(this);
    this.getPaymentStatus = this.getPaymentStatus.bind(this);
    this.handlePesapalIPN = this.handlePesapalIPN.bind(this);
    this.testPesapalAuth = this.testPesapalAuth.bind(this);
  }

  // Test Pesapal authentication
  async testPesapalAuth(req, res) {
    try {
      console.log('🧪 Testing Pesapal authentication endpoint called...');
      const result = await pesapalService.testAuthentication();
      
      res.json({
        success: result.success,
        message: result.success ? 'Pesapal authentication successful' : 'Pesapal authentication failed',
        environment: result.environment,
        baseUrl: result.baseUrl,
        error: result.error,
        timestamp: new Date().toISOString()
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
    const ref = `BIPS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
        return res.status(400).json({ error: 'Valid amount is required' });
      }
      if (!customerEmail || !customerName) {
        return res.status(400).json({ error: 'Customer email and name are required' });
      }

      const merchantReference = this.generateMerchantReference();
      
      console.log('📦 Creating payment record in database...');

      // Create payment record in MongoDB
      const paymentRecord = new Payment({
        pesapalMerchantReference: merchantReference,
        amount,
        currency: currency || 'KES',
        status: 'pending',
        customerEmail,
        customerName,
        customerPhone: customerPhone || '',
        description: description || `BIPS Payment - ${amount} KES`,
        callbackUrl: `${process.env.BASE_URL || 'http://localhost:3001'}/api/payments/callback`,
        cancellationUrl: `${process.env.BASE_URL || 'http://localhost:3001'}/api/payments/cancel`
      });

      await paymentRecord.save();
      console.log('✅ Payment record saved to database:', paymentRecord._id);

      // Submit order to Pesapal
      console.log('🔄 Submitting to Pesapal API...');
      const pesapalResponse = await pesapalService.submitOrderRequest({
        merchantReference,
        amount,
        currency: currency || 'KES',
        description: description || `BIPS Payment - ${amount} KES`,
        customerEmail,
        customerName,
        customerPhone: customerPhone || '',
        callbackUrl: `${process.env.BASE_URL || 'http://localhost:3001'}/api/payments/callback`,
        cancellationUrl: `${process.env.BASE_URL || 'http://localhost:3001'}/api/payments/cancel`
      });

      console.log('✅ Pesapal API response received:', {
        trackingId: pesapalResponse.order_tracking_id,
        redirectUrl: pesapalResponse.redirect_url ? 'Yes' : 'No',
        hasRedirect: !!pesapalResponse.redirect_url
      });

      // Update with tracking ID
      paymentRecord.pesapalTrackingId = pesapalResponse.order_tracking_id;
      await paymentRecord.save();
      console.log('✅ Payment record updated with tracking ID');

      res.status(201).json({
        success: true,
        redirectUrl: pesapalResponse.redirect_url,
        merchantReference,
        pesapalTrackingId: pesapalResponse.order_tracking_id,
        amount,
        currency: currency || 'KES',
        paymentRecord: {
          id: paymentRecord._id,
          status: paymentRecord.status
        }
      });

    } catch (error) {
      console.error('❌ CREATE PAYMENT REQUEST FAILED:', error);
      res.status(500).json({ 
        error: 'Failed to create payment request',
        details: error.message 
      });
    }
  }

  // Payment callback handler (after payment)
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
        }
      }

      // Redirect to frontend success page
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      console.log(`🔀 Redirecting to frontend: ${frontendUrl}/payment-success`);
      res.redirect(`${frontendUrl}/payment-success?reference=${OrderMerchantReference}`);

    } catch (error) {
      console.error('❌ Callback handling error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
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
          { status: 'canceled' }
        );
        console.log(`✅ Payment marked as canceled: ${OrderMerchantReference}`);
      }

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/payment-canceled`);

    } catch (error) {
      console.error('❌ Cancel handling error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/payment-error`);
    }
  }

  // IPN (Instant Payment Notification) handler
  async handleIpn(req, res) {
    try {
      const ipnData = req.body;
      
      console.log('📨 IPN received:', ipnData);

      // For sandbox, we'll skip verification. In production, implement proper verification
      const isValid = true; // pesapalService.verifyIpnCallback(ipnData, req.headers['signature']);
      
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid IPN signature' });
      }

      // Update payment status based on IPN
      if (ipnData.OrderMerchantReference) {
        await Payment.findOneAndUpdate(
          { pesapalMerchantReference: ipnData.OrderMerchantReference },
          {
            status: this.mapPesapalStatus(ipnData.Status),
            paymentMethod: ipnData.PaymentMethod || 'other'
          }
        );
        console.log(`✅ IPN processed: ${ipnData.OrderMerchantReference} -> ${ipnData.Status}`);
      }

      res.json({ status: 'OK' });

    } catch (error) {
      console.error('❌ IPN handling error:', error);
      res.status(500).json({ error: 'IPN processing failed' });
    }
  }

  // Get payment status
  async getPaymentStatus(req, res) {
    try {
      const { merchantReference } = req.params;

      console.log('🔍 Getting payment status for:', merchantReference);

      const paymentRecord = await Payment.findOne({ 
        pesapalMerchantReference: merchantReference 
      });

      if (!paymentRecord) {
        console.log('❌ Payment not found:', merchantReference);
        return res.status(404).json({ error: 'Payment not found' });
      }

      // Get latest status from Pesapal
      const pesapalStatus = await pesapalService.getPaymentStatus(merchantReference);

      console.log('✅ Payment status retrieved:', {
        merchantReference,
        status: paymentRecord.status,
        pesapalStatus: pesapalStatus.status
      });

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
        error: 'Failed to get payment status',
        details: error.message 
      });
    }
  }

  // Map Pesapal status to internal status
  mapPesapalStatus(pesapalStatus) {
    const statusMap = {
      'Completed': 'completed',
      'Failed': 'failed', 
      'Invalid': 'failed',
      'Pending': 'pending',
      'Canceled': 'canceled'
    };
    
    return statusMap[pesapalStatus] || 'pending';
  }

  // Handle Pesapal IPN (for the /ipn route)
  async handlePesapalIPN(req, res) {
    console.log('📨 Pesapal IPN Received - Headers:', req.headers);
    console.log('🔍 Pesapal IPN Received - Body:', req.body);
    console.log('🌐 Pesapal IPN Received - Query:', req.query);
    console.log('⚡ Pesapal IPN Received - Method:', req.method);

    try {
      // Handle GET requests (Pesapal verification)
      if (req.method === 'GET') {
        console.log('✅ Pesapal IPN Verification Request');
        return res.status(200).json({ 
          status: 'active',
          message: 'IPN is working correctly',
          timestamp: new Date().toISOString()
        });
      }

      // Handle POST requests (actual IPN notifications)
      if (req.method === 'POST') {
        const ipnData = req.body;
        
        console.log('💰 Processing Pesapal IPN:', {
          orderTrackingId: ipnData.order_tracking_id,
          orderNotificationType: ipnData.order_notification_type,
          paymentStatus: ipnData.payment_status,
          paymentMethod: ipnData.payment_method,
          amount: ipnData.amount,
          currency: ipnData.currency,
          merchantReference: ipnData.merchant_reference,
          timestamp: ipnData.timestamp
        });

        // Validate required fields
        if (!ipnData.order_tracking_id || !ipnData.payment_status) {
          console.warn('⚠️ Missing required fields in IPN');
          return res.status(200).json({ status: 'success' }); // Still return success to Pesapal
        }

        // Update payment status in database      
        const updatedPayment = await Payment.findOneAndUpdate(
          { pesapalTrackingId: ipnData.order_tracking_id },
          {
            paymentStatus: ipnData.payment_status,
            paymentMethod: ipnData.payment_method,
            ipnReceived: true,
            ipnData: ipnData,
            updatedAt: new Date()
          },
          { new: true }
        );

        if (updatedPayment) {
          console.log('✅ Payment updated in database:', updatedPayment._id);
          
          // Handle specific payment statuses
          if (ipnData.payment_status === 'COMPLETED') {
            console.log('🎉 Payment COMPLETED for order:', ipnData.order_tracking_id);
            // Trigger any post-payment actions here (email notifications, etc.)
          }
        } else {
          console.warn('❌ Payment not found for order:', ipnData.order_tracking_id);
        }

        // Always return success to Pesapal (important!)
        return res.status(200).json({ 
          status: 'success',
          message: 'IPN processed successfully'
        });
      }

      // Method not allowed
      return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
      console.error('💥 IPN Processing Error:', error);
      
      // Still return success to Pesapal to prevent retries for the same transaction
      return res.status(200).json({ 
        status: 'success',
        message: 'IPN received (error logged)'
      });
    }
  }
}

module.exports = new PaymentController();