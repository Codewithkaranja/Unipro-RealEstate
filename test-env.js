require('dotenv').config();

console.log('🔍 Testing credentials...');
console.log('✅ Cloudinary Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('✅ Cloudinary API Key:', process.env.CLOUDINARY_API_KEY?.substring(0, 5) + '...');
console.log('✅ Cloudinary API Secret length:', process.env.CLOUDINARY_API_SECRET?.length || 'MISSING');
console.log('✅ MongoDB URI set:', !!process.env.MONGODB_URI);
console.log('❌ Old MONGO_URI (should be undefined):', process.env.MONGO_URI || 'Good - not set');

// Test Cloudinary
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

cloudinary.api.ping()
  .then(() => console.log('🎉 Cloudinary: CONNECTED SUCCESSFULLY!'))
  .catch(err => console.log('❌ Cloudinary error:', err.message));
