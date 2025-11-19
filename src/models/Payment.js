const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  pesapalMerchantReference: {
    type: String,
    required: true,
    unique: true
  },
  pesapalTrackingId: {
    type: String,
    unique: true,
    sparse: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'KES'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'canceled'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['mpesa', 'card', 'bank', 'other'],
    default: 'other'
  },
  customerEmail: {
    type: String,
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  customerPhone: {
    type: String
  },
  description: {
    type: String,
    required: true
  },
  callbackUrl: {
    type: String,
    required: true
  },
  cancellationUrl: {
    type: String,
    required: true
  },
  metadata: {
    type: Map,
    of: String
  }
}, {
  timestamps: true
});

// NEW indexes - remove old stripe indexes
paymentSchema.index({ pesapalMerchantReference: 1 });
paymentSchema.index({ pesapalTrackingId: 1 });
paymentSchema.index({ customerEmail: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: 1 });

module.exports = mongoose.model('Payment', paymentSchema);