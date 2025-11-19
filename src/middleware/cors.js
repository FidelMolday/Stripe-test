const cors = require('cors');

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://bipstechnicalcollege.co.ke', // Your production domain
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      'https://stripe-test-yb9k.onrender.com' // Your backend itself
    ];
    
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if the origin is in the allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('🚫 Blocked by CORS:', origin);
      console.log('✅ Allowed origins:', allowedOrigins);
      callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Stripe-Signature',
    'X-Requested-With',
    'Accept'
  ],
  exposedHeaders: [
    'Content-Range',
    'X-Content-Range'
  ],
  maxAge: 86400 // 24 hours
};

module.exports = cors(corsOptions);