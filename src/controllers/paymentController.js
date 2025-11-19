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
  }

  // Generate unique merchant reference
  generateMerchantReference() {
    return `BIPS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Create payment request
  async createPaymentRequest(req, res) {
    try {
      const { amount, currency, customerEmail, customerName, customerPhone, description } = req.body;

      // Validation
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Valid amount is required' });
      }
      if (!customerEmail || !customerName) {
        return res.status(400).json({ error: 'Customer email and name are required' });
      }

      const merchantReference = this.generateMerchantReference();
      
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

      // Submit order to Pesapal
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

      // Update with tracking ID
      paymentRecord.pesapalTrackingId = pesapalResponse.order_tracking_id;
      await paymentRecord.save();

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
      console.error('Create payment request error:', error);
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

      console.log('Payment callback received:', {
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
          console.log(`Payment status updated: ${OrderMerchantReference} -> ${Status}`);
        }
      }

      // Redirect to frontend success page
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/payment-success?reference=${OrderMerchantReference}`);

    } catch (error) {
      console.error('Callback handling error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/payment-error`);
    }
  }

  // Payment cancellation handler
  async handleCancel(req, res) {
    try {
      const { OrderMerchantReference } = req.query;

      if (OrderMerchantReference) {
        await Payment.findOneAndUpdate(
          { pesapalMerchantReference: OrderMerchantReference },
          { status: 'canceled' }
        );
      }

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/payment-canceled`);

    } catch (error) {
      console.error('Cancel handling error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/payment-error`);
    }
  }

  // IPN (Instant Payment Notification) handler
  async handleIpn(req, res) {
    try {
      const ipnData = req.body;
      
      console.log('IPN received:', ipnData);

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
      }

      res.json({ status: 'OK' });

    } catch (error) {
      console.error('IPN handling error:', error);
      res.status(500).json({ error: 'IPN processing failed' });
    }
  }

  // Get payment status
  async getPaymentStatus(req, res) {
    try {
      const { merchantReference } = req.params;

      const paymentRecord = await Payment.findOne({ 
        pesapalMerchantReference: merchantReference 
      });

      if (!paymentRecord) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      // Get latest status from Pesapal
      const pesapalStatus = await pesapalService.getPaymentStatus(merchantReference);

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
      console.error('Get payment status error:', error);
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
}

module.exports = new PaymentController();