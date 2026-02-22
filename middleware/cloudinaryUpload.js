// middleware/cloudinaryUpload.js
const cloudinary = require('cloudinary').v2;

const uploadToCloudinary = (buffer, folder = 'propertybyfridah') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        format: 'webp',
        quality: 'auto',
        transformation: [
          { width: 1920, height: 1080, crop: 'limit' },
          { quality: 'auto:good' }
        ],
        resource_type: 'image',
        timeout: 60000
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    
    stream.end(buffer);
  });
};

const processUploadedImages = async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next();
  }

  console.log(`📤 Processing ${req.files.length} files for Cloudinary upload`);

  try {
    const uploadPromises = req.files.map(async (file, index) => {
      try {
        // Validate file
        if (!file.buffer || file.buffer.length === 0) {
          throw new Error(`File ${index + 1} is empty`);
        }

        if (file.buffer.length > 5 * 1024 * 1024) {
          throw new Error(`File ${index + 1} exceeds 5MB limit`);
        }

        console.log(`🔄 Uploading file ${index + 1} (${(file.buffer.length / 1024 / 1024).toFixed(2)}MB)`);
        
        const result = await uploadToCloudinary(file.buffer, 'propertybyfridah/properties');
        
        console.log(`✅ File ${index + 1} uploaded: ${result.public_id}`);
        
        return {
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
          originalName: file.originalname
        };
      } catch (uploadError) {
        console.error(`❌ Failed to upload file ${index + 1}:`, uploadError.message);
        return null;
      }
    });

    const results = await Promise.all(uploadPromises);
    
    // Filter out failed uploads
    req.processedFiles = results.filter(result => result !== null);
    
    if (req.processedFiles.length === 0 && req.files.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to upload any images',
        code: 'UPLOAD_FAILED'
      });
    }

    console.log(`🎉 Successfully uploaded ${req.processedFiles.length}/${req.files.length} files`);
    next();
  } catch (error) {
    console.error('🚨 Image processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process images',
      code: 'IMAGE_PROCESSING_ERROR'
    });
  }
};

module.exports = { processUploadedImages, uploadToCloudinary };