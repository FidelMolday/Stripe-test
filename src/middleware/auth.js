// Simple API key authentication (optional for now)
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  // For development, we'll skip authentication
  // For production, you can implement proper API key validation
  if (process.env.NODE_ENV === 'production' && apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }
  
  next();
};

module.exports = { apiKeyAuth };