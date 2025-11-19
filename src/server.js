const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const connectDB = require('./config/database');
const paymentRoutes = require('./routes/paymentRoutes');
const WebhookSetup = require('./utils/webhookSetup');

const app = express();

// Check configuration on startup
console.log('\n🔧 Checking configuration...');
const configCheck = WebhookSetup.validateConfig();
configCheck.issues.forEach(issue => console.log(issue));

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Stripe webhook needs raw body
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Routes
app.use('/api/payments', paymentRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'BIPS Payment Backend is running',
    timestamp: new Date().toISOString(),
    config: configCheck.config
  });
});

// Webhook setup instructions
app.get('/api/webhook-setup', (req, res) => {
  res.json(WebhookSetup.getWebhookInstructions());
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`\n🚀 BIPS Payment Backend running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`📋 Webhook setup: http://localhost:${PORT}/api/webhook-setup`);
      
      if (!configCheck.isValid) {
        console.log('\n⚠️ Configuration issues detected. Check the messages above.');
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();