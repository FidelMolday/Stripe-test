const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Create payment intent
router.post('/create-intent', paymentController.createPaymentIntent);

// Confirm payment
router.post('/confirm', paymentController.confirmPayment);

// Get payment status
router.get('/status/:paymentIntentId', paymentController.getPaymentStatus);

// Stripe webhook (must be raw body)
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;