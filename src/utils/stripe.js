const Stripe = require('stripe');

// Check if Stripe secret key is available
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY is missing from environment variables');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

console.log('✅ Stripe initialized with key:', process.env.STRIPE_SECRET_KEY ? 'Key present' : 'Key missing');

class StripeService {
  // Create a payment intent
  async createPaymentIntent(amount, currency, metadata = {}) {
    try {
      console.log('💰 Creating payment intent for amount:', amount);
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency || 'usd',
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: metadata
      });

      console.log('✅ Payment intent created:', paymentIntent.id);

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100, // Convert back to dollars
        currency: paymentIntent.currency,
        status: paymentIntent.status
      };
    } catch (error) {
      console.error('❌ Stripe createPaymentIntent error:', error);
      throw new Error(`Payment intent creation failed: ${error.message}`);
    }
  }

  // Confirm payment intent
  async confirmPaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      console.error('Stripe confirmPaymentIntent error:', error);
      throw new Error(`Payment confirmation failed: ${error.message}`);
    }
  }

  // Handle webhook events
  async handleWebhookEvent(payload, signature) {
    try {
      // For development without webhook secret, return the event directly
      if (!process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET.includes('temporary')) {
        console.log('⚠️ Using development mode - webhook signature verification skipped');
        return JSON.parse(payload.toString());
      }

      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      return event;
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw new Error(`Webhook error: ${error.message}`);
    }
  }

  // Get Stripe publishable key
  getPublishableKey() {
    return process.env.STRIPE_PUBLISHABLE_KEY;
  }
}

module.exports = new StripeService();