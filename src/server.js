const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

const connectDB = require('./config/database');
const paymentRoutes = require('./routes/paymentRoutes');


const app = express();

// Remove CORS completely - allow all origins
console.log('🚫 CORS disabled - accepting requests from all origins');

// Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/api/payments', paymentRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'BIPS Payment Backend with Pesapal is running',
    timestamp: new Date().toISOString(),
    paymentProvider: 'Pesapal',
    environment: process.env.PESAPAL_ENV || 'sandbox'
  });
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
      console.log(`\n🚀 BIPS Pesapal Payment Backend running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`💰 Payment Provider: Pesapal`);
      console.log(`🌐 Environment: ${process.env.PESAPAL_ENV || 'sandbox'}`);
      console.log(`🚫 CORS: Disabled - accepting all origins`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();