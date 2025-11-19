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

// CORS configuration
const corsOptions = {
  origin: [
    'https://bipstechnicalcollege.co.ke',
    'http://localhost:5173', 
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'https://stripe-test-yb9k.onrender.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Stripe-Signature',
    'X-Requested-With',
    'Accept'
  ]
};

// Apply CORS to all routes
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Stripe webhook needs raw body (must come before other middleware)
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Routes
app.use('/api/payments', paymentRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'BIPS Payment Backend is running',
    timestamp: new Date().toISOString(),
    config: configCheck.config,
    cors: {
      allowedOrigins: [
        'https://bipstechnicalcollege.co.ke',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'https://stripe-test-yb9k.onrender.com'
      ]
    }
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
  
  // Handle CORS errors specifically
  if (error.message.includes('CORS')) {
    return res.status(403).json({ 
      error: 'CORS Error',
      message: 'Origin not allowed',
      details: error.message
    });
  }
  
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
      console.log(`🌐 CORS enabled for:`);
      console.log(`   - https://bipstechnicalcollege.co.ke`);
      console.log(`   - http://localhost:5173`);
      console.log(`   - http://127.0.0.1:5173`);
      console.log(`   - http://localhost:3000`);
      console.log(`   - https://stripe-test-yb9k.onrender.com`);
      
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