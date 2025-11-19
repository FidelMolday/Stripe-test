const validatePaymentIntent = (req, res, next) => {
  const { amount, customerEmail, customerName } = req.body;

  const errors = [];

  if (!amount || amount <= 0) {
    errors.push('Valid amount is required');
  }

  if (!customerEmail || !/\S+@\S+\.\S+/.test(customerEmail)) {
    errors.push('Valid customer email is required');
  }

  if (!customerName || customerName.trim().length < 2) {
    errors.push('Customer name is required and must be at least 2 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: errors 
    });
  }

  next();
};

module.exports = { validatePaymentIntent };