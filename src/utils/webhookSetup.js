const stripeService = require('./stripe');

class WebhookSetup {
  // Method to help set up webhooks in Stripe Dashboard
  static getWebhookInstructions() {
    const webhookUrl = `http://localhost:${process.env.PORT || 3001}/api/payments/webhook`;
    
    return {
      instructions: 'To set up Stripe webhooks:',
      steps: [
        '1. Go to Stripe Dashboard: https://dashboard.stripe.com/webhooks',
        '2. Click "Add endpoint"',
        `3. Enter URL: ${webhookUrl}`,
        '4. Select events to send:',
        '   - payment_intent.succeeded',
        '   - payment_intent.payment_failed', 
        '   - payment_intent.canceled',
        '5. Copy the "Signing secret" and update your .env file',
        '6. Restart the server'
      ],
      currentWebhookUrl: webhookUrl,
      requiredEvents: [
        'payment_intent.succeeded',
        'payment_intent.payment_failed',
        'payment_intent.canceled'
      ]
    };
  }

  // Validate webhook configuration
  static validateConfig() {
    const issues = [];

    if (!process.env.STRIPE_SECRET_KEY) {
      issues.push('❌ STRIPE_SECRET_KEY is missing');
    }

    if (!process.env.STRIPE_PUBLISHABLE_KEY) {
      issues.push('❌ STRIPE_PUBLISHABLE_KEY is missing');
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET.includes('temporary')) {
      issues.push('⚠️ Using temporary webhook secret - for production, get real secret from Stripe Dashboard');
    }

    return {
      isValid: issues.length === 0,
      issues: issues,
      config: {
        hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
        hasPublishableKey: !!process.env.STRIPE_PUBLISHABLE_KEY,
        hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET && !process.env.STRIPE_WEBHOOK_SECRET.includes('temporary'),
        webhookUrl: `http://localhost:${process.env.PORT || 3001}/api/payments/webhook`
      }
    };
  }
}

module.exports = WebhookSetup;