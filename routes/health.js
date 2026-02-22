// routes/health.js
const router = require('express').Router();
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

router.get('/deep', async (req, res) => {
  const checks = {
    database: 'pending',
    cloudinary: 'pending',
    memory: 'pending'
  };
  
  try {
    // Check database
    await mongoose.connection.db.admin().ping();
    checks.database = 'healthy';
    
    // Check Cloudinary
    await cloudinary.api.ping();
    checks.cloudinary = 'healthy';
    
    // Memory usage
    checks.memory = {
      rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)}MB`,
      heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB`,
      heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)}MB`
    };
    
    res.json({
      success: true,
      status: 'healthy',
      checks,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      checks,
      error: error.message, 
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;