// scripts/final-verification.js
const axios = require('axios');

async function verifyDeployment() {
  // Use environment variable or default to your production URL
  const baseUrl = process.env.API_URL || 'https://uniprorealestate.co.ke';
  
  const tests = [
    { name: 'Health Check', endpoint: '/api/listings/health', method: 'GET' },
    { name: 'Get Listings', endpoint: '/api/listings', method: 'GET' },
    { name: 'Create Sample Listing', endpoint: '/api/listings/sample', method: 'POST' },
  ];
  
  console.log('🔍 Running deployment verification for Unipro Real Estate...');
  
  for (const test of tests) {
    try {
      const response = await axios({
        method: test.method,
        url: baseUrl + test.endpoint,
        timeout: 10000,
        // For POST sample, we don't need body; it handles internally
      });
      
      console.log(`✅ ${test.name}: ${response.status} - ${response.data.success ? 'SUCCESS' : 'FAILED'}`);
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
    }
  }
  
  console.log('🎉 Verification complete!');
}

verifyDeployment();