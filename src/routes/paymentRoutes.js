const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Create payment request
router.post('/create-request', paymentController.createPaymentRequest);

// Payment callback (after payment)
router.get('/callback', paymentController.handleCallback);

// Payment cancellation
router.get('/cancel', paymentController.handleCancel);

// IPN handler (Instant Payment Notification)
router.all('/ipn', paymentController.handlePesapalIPN);

// Get payment status
router.get('/status/:merchantReference', paymentController.getPaymentStatus);

module.exports = router;