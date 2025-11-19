const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Manual URI construction to handle special characters properly
    const username = 'fidelouma363_db_user';
    const password = 'moldays@2025bips'; // Keep original password
    const encodedPassword = encodeURIComponent(password); // This will encode @ to %40
    const cluster = 'stripepayment.omfbzq1.mongodb.net';
    const dbName = 'bips-payments';
    
    const mongoURI = `mongodb+srv://${username}:${encodedPassword}@${cluster}/${dbName}?retryWrites=true&w=majority&appName=stripepayment`;

    console.log('🔗 Attempting MongoDB connection...');
    
    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds socket timeout
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    console.log(`🎯 Connection state: ${conn.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);

  } catch (error) {
    console.error('❌ MongoDB connection failed:');
    console.error('   Error name:', error.name);
    console.error('   Error message:', error.message);
    
    if (error.name === 'MongoServerSelectionError') {
      console.error('   💡 Possible causes:');
      console.error('      - Network connectivity issues');
      console.error('      - IP not whitelisted in MongoDB Atlas');
      console.error('      - Incorrect credentials');
      console.error('      - Cluster paused or down');
    }
    
    if (error.message.includes('authentication')) {
      console.error('   🔐 Authentication failed - check username/password');
    }
    
    if (error.message.includes('ENOTFOUND')) {
      console.error('   🌐 DNS resolution failed - check cluster URL');
    }
    
    process.exit(1);
  }
};

// MongoDB connection event handlers
mongoose.connection.on('connected', () => {
  console.log('🎯 Mongoose connected to MongoDB');
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ Mongoose disconnected from MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err.message);
});

mongoose.connection.on('reconnected', () => {
  console.log('🔁 Mongoose reconnected to MongoDB');
});

// Close Mongoose connection when app is terminated
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('👋 MongoDB connection closed through app termination');
  process.exit(0);
});

module.exports = connectDB;