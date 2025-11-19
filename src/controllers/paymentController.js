const stripeService = require('../utils/stripe');
const Payment = require('../models/Payment');

class PaymentController {
  // Create payment intent
  async createPaymentIntent(req, res) {
    try {
      const { amount, currency, customerEmail, customerName, description, metadata } = req.body;

      // Validation
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Valid amount is required' });
      }
      if (!customerEmail || !customerName) {
        return res.status(400).json({ error: 'Customer email and name are required' });
      }

      // Create payment intent with Stripe
      const paymentData = await stripeService.createPaymentIntent(
        amount,
        currency,
        {
          customerEmail,
          customerName,
          description,
          ...metadata
        }
      );

      // Save to MongoDB
      const paymentRecord = new Payment({
        stripePaymentIntentId: paymentData.paymentIntentId,
        amount: paymentData.amount,
        currency: paymentData.currency,
        status: 'pending',
        customerEmail,
        customerName,
        description: description || `Payment of ${amount} ${currency || 'usd'}`,
        metadata: metadata || {}
      });

      await paymentRecord.save();

      res.status(201).json({
        success: true,
        clientSecret: paymentData.clientSecret,
        paymentIntentId: paymentData.paymentIntentId,
        amount: paymentData.amount,
        currency: paymentData.currency,
        paymentRecord: {
          id: paymentRecord._id,
          status: paymentRecord.status
        }
      });

    } catch (error) {
      console.error('Create payment intent error:', error);
      res.status(500).json({ 
        error: 'Failed to create payment intent',
        details: error.message 
      });
    }
  }

  // Confirm payment
  async confirmPayment(req, res) {
    try {
      const { paymentIntentId } = req.body;

      if (!paymentIntentId) {
        return res.status(400).json({ error: 'Payment intent ID is required' });
      }

      // Retrieve payment intent from Stripe
      const paymentIntent = await stripeService.confirmPaymentIntent(paymentIntentId);

      // Update payment record in MongoDB
      const paymentRecord = await Payment.findOneAndUpdate(
        { stripePaymentIntentId: paymentIntentId },
        {
          status: paymentIntent.status,
          $set: {
            metadata: {
              ...paymentIntent.metadata,
              lastStripeStatus: paymentIntent.status,
              updatedAt: new Date()
            }
          }
        },
        { new: true }
      );

      if (!paymentRecord) {
        return res.status(404).json({ error: 'Payment record not found' });
      }

      res.json({
        success: true,
        status: paymentIntent.status,
        payment: {
          id: paymentRecord._id,
          amount: paymentRecord.amount,
          currency: paymentRecord.currency,
          status: paymentRecord.status,
          customerEmail: paymentRecord.customerEmail,
          customerName: paymentRecord.customerName
        }
      });

    } catch (error) {
      console.error('Confirm payment error:', error);
      res.status(500).json({ 
        error: 'Failed to confirm payment',
        details: error.message 
      });
    }
  }

  // Handle webhook events
  async handleWebhook(req, res) {
    let event;

    try {
      const signature = req.headers['stripe-signature'];
      
      // For now, we'll log the webhook but not verify signature until we have the secret
      console.log('Webhook received (signature verification skipped for development)');
      console.log('Webhook payload:', JSON.stringify(req.body, null, 2));
      
      // Temporary: Parse event without verification for development
      event = req.body;
      
      // Once you have webhook secret, uncomment below:
      // event = await stripeService.handleWebhookEvent(req.body, signature);

    } catch (error) {
      console.error('Webhook error:', error);
      return res.status(400).json({ error: `Webhook Error: ${error.message}` });
    }

    // Handle the event
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
        case 'payment_intent.canceled':
          await this.handlePaymentCanceled(event.data.object);
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Error processing webhook' });
    }
  }

  // Handle successful payment
  async handlePaymentSucceeded(paymentIntent) {
    try {
      await Payment.findOneAndUpdate(
        { stripePaymentIntentId: paymentIntent.id },
        {
          status: 'succeeded',
          $set: {
            metadata: {
              ...paymentIntent.metadata,
              stripeAmountReceived: paymentIntent.amount_received,
              stripeCurrency: paymentIntent.currency,
              lastStripeStatus: paymentIntent.status,
              succeededAt: new Date()
            }
          }
        }
      );
      console.log(`✅ Payment succeeded: ${paymentIntent.id}`);
    } catch (error) {
      console.error('Error updating succeeded payment:', error);
    }
  }

  // Handle failed payment
  async handlePaymentFailed(paymentIntent) {
    try {
      await Payment.findOneAndUpdate(
        { stripePaymentIntentId: paymentIntent.id },
        {
          status: 'failed',
          $set: {
            metadata: {
              ...paymentIntent.metadata,
              lastPaymentError: paymentIntent.last_payment_error,
              lastStripeStatus: paymentIntent.status,
              failedAt: new Date()
            }
          }
        }
      );
      console.log(`❌ Payment failed: ${paymentIntent.id}`);
    } catch (error) {
      console.error('Error updating failed payment:', error);
    }
  }

  // Handle canceled payment
  async handlePaymentCanceled(paymentIntent) {
    try {
      await Payment.findOneAndUpdate(
        { stripePaymentIntentId: paymentIntent.id },
        {
          status: 'canceled',
          $set: {
            metadata: {
              ...paymentIntent.metadata,
              cancellationReason: paymentIntent.cancellation_reason,
              lastStripeStatus: paymentIntent.status,
              canceledAt: new Date()
            }
          }
        }
      );
      console.log(`⚠️ Payment canceled: ${paymentIntent.id}`);
    } catch (error) {
      console.error('Error updating canceled payment:', error);
    }
  }

  // Get payment status
  async getPaymentStatus(req, res) {
    try {
      const { paymentIntentId } = req.params;

      const paymentRecord = await Payment.findOne({ 
        stripePaymentIntentId: paymentIntentId 
      });

      if (!paymentRecord) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      res.json({
        success: true,
        payment: {
          id: paymentRecord._id,
          stripePaymentIntentId: paymentRecord.stripePaymentIntentId,
          amount: paymentRecord.amount,
          currency: paymentRecord.currency,
          status: paymentRecord.status,
          customerEmail: paymentRecord.customerEmail,
          customerName: paymentRecord.customerName,
          description: paymentRecord.description,
          createdAt: paymentRecord.createdAt,
          updatedAt: paymentRecord.updatedAt
        }
      });

    } catch (error) {
      console.error('Get payment status error:', error);
      res.status(500).json({ 
        error: 'Failed to get payment status',
        details: error.message 
      });
    }
  }
}

module.exports = new PaymentController();