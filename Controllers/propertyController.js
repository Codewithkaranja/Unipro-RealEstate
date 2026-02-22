const mongoose = require('mongoose');
const Property = require('../models/Property');
const cloudinary = require('../utils/cloudinary');

// ===================== HELPER FUNCTIONS =====================

function parsePrice(price) {
  if (typeof price === 'number') return Math.round(price);
  if (!price) return 0;
  
  const cleaned = price.toString()
    .replace(/KES\s*/i, '')
    .replace(/,/g, '')
    .trim();
  
  const numeric = parseFloat(cleaned);
  return isNaN(numeric) ? 0 : Math.round(numeric);
}

// ===================== GET ALL PROPERTIES =====================
exports.getProperties = async (req, res) => {
  try {
    console.log('📊 Fetching properties...');
    const properties = await Property.find().sort({ createdAt: -1 });
    
    console.log(`✅ Found ${properties.length} properties`);
    
    // Format properties for frontend
    const formatted = properties.map(p => ({
      _id: p._id,
      title: p.title,
      location: p.location,
      type: p.type,
      priceNum: p.priceNum || 0,
      price: p.price || 'KES 0',
      bedrooms: p.bedrooms || 0,
      bathrooms: p.bathrooms || 0,
      parking: p.parking || 0,
      size: p.size || '',
      status: p.status || 'available',
      description: p.description || '',
      whatsapp: p.whatsapp || '254721911181',
      images: p.images || [],
      cloudinaryPublicIds: p.cloudinaryPublicIds || [], // Include for reference
      createdAt: p.createdAt
    }));

    res.json(formatted);

  } catch (err) {
    console.error('❌ Error in getProperties:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch properties',
      error: process.env.NODE_ENV === 'production' ? 'Server error' : err.message
    });
  }
};

// ===================== GET SINGLE PROPERTY =====================
exports.getPropertyById = async (req, res) => {
  try {
    console.log(`🔍 Fetching property: ${req.params.id}`);
    const property = await Property.findById(req.params.id);
    
    if (!property) {
      return res.status(404).json({ 
        success: false,
        message: 'Property not found' 
      });
    }

    res.json({
      success: true,
      data: {
        _id: property._id,
        title: property.title,
        location: property.location,
        type: property.type,
        priceNum: property.priceNum || 0,
        price: property.price || 'KES 0',
        bedrooms: property.bedrooms || 0,
        bathrooms: property.bathrooms || 0,
        parking: property.parking || 0,
        size: property.size || '',
        status: property.status || 'available',
        description: property.description || '',
        whatsapp: property.whatsapp || '254721911181',
        images: property.images || [],
        cloudinaryPublicIds: property.cloudinaryPublicIds || [],
        createdAt: property.createdAt
      }
    });
  } catch (err) {
    console.error('❌ Error in getPropertyById:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch property',
      error: process.env.NODE_ENV === 'production' ? 'Server error' : err.message
    });
  }
};

// ===================== ADD NEW PROPERTY (CLOUDINARY VERSION) =====================
exports.addProperty = async (req, res) => {
  try {
    console.log('➕ Starting addProperty (Cloudinary)...');
    console.log('📦 Request body keys:', Object.keys(req.body));
    console.log('🖼️ req.processedFiles:', req.processedFiles ? req.processedFiles.length : 0);
    
    const {
      title,
      location,
      type,
      price,
      priceNum,
      bedrooms = 0,
      bathrooms = 0,
      parking = 0,
      size = '',
      status = 'available',
      description = '',
      whatsapp = '254721911181'
    } = req.body;

    // Validate required fields
    if (!title || !location || !type || !price || !priceNum) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields',
        required: ['title', 'location', 'type', 'price', 'priceNum'],
        received: { title, location, type, price, priceNum }
      });
    }

    // Parse price
    const numericPrice = parsePrice(price);
    console.log(`💰 Price parsing: "${price}" → ${numericPrice}`);
    
    if (numericPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid price format',
        example: 'KES 8,500,000 or 8500000'
      });
    }

    // Get Cloudinary URLs and publicIds
    const images = req.processedFiles ? req.processedFiles.map(file => file.url) : [];
    const cloudinaryPublicIds = req.processedFiles ? req.processedFiles.map(file => file.publicId) : [];
    
    console.log(`🖼️ Cloudinary images to save: ${images.length} files`);
    console.log(`🔑 Cloudinary publicIds: ${cloudinaryPublicIds.length}`);

    // Format price for display
    const formattedPrice = `KES ${numericPrice.toLocaleString()}`;
    
    // Create property object
    const propertyData = {
      title: title.trim(),
      location: location.trim(),
      type: type.trim().toLowerCase(),
      price: formattedPrice,
      priceNum: numericPrice,
      bedrooms: parseInt(bedrooms) || 0,
      bathrooms: parseInt(bathrooms) || 0,
      parking: parseInt(parking) || 0,
      size: (size || '').trim(),
      status: (status || 'available').trim().toLowerCase(),
      description: (description || '').trim(),
      whatsapp: (whatsapp || '254721911181').trim(),
      images: images,
      cloudinaryPublicIds: cloudinaryPublicIds
    };

    console.log('📝 Creating property with data:', {
      title: propertyData.title,
      location: propertyData.location,
      type: propertyData.type,
      price: propertyData.price,
      imagesCount: propertyData.images.length
    });

    // Save to database
    const newProperty = new Property(propertyData);
    const savedProperty = await newProperty.save();
    
    console.log(`✅ Property saved with Cloudinary: ${savedProperty._id}`);

    // Return success response
    res.status(201).json({
      success: true,
      data: savedProperty,
      message: 'Property added successfully with Cloudinary images'
    });

  } catch (err) {
    console.error('❌ Error in addProperty:', err);
    
    // Clean up Cloudinary images if there's an error
    if (req.processedFiles && req.processedFiles.length > 0) {
      console.log('🧹 Cleaning up Cloudinary images due to error...');
      await Promise.all(
        req.processedFiles.map(file => 
          cloudinary.uploader.destroy(file.publicId)
            .catch(cleanupErr => 
              console.warn('Failed to cleanup Cloudinary image:', cleanupErr.message)
            )
        )
      );
    }
    
    // Handle specific MongoDB errors
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }
    
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate property',
        error: 'A property with similar details already exists'
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to add property',
      error: process.env.NODE_ENV === 'production' ? 'Server error. Please try again.' : err.message
    });
  }
};

// ===================== UPDATE PROPERTY (CLOUDINARY VERSION) =====================
exports.updateProperty = async (req, res) => {
  try {
    console.log(`✏️ Updating property: ${req.params.id}`);
    
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ 
        success: false,
        message: 'Property not found' 
      });
    }

    // Extract update data
    const updateData = { ...req.body };
    
    // If new images are uploaded, add to existing images
    if (req.processedFiles && req.processedFiles.length > 0) {
      const newImages = req.processedFiles.map(file => file.url);
      const newPublicIds = req.processedFiles.map(file => file.publicId);
      
      updateData.images = [...(property.images || []), ...newImages];
      updateData.cloudinaryPublicIds = [...(property.cloudinaryPublicIds || []), ...newPublicIds];
    }

    // Update priceNum if price is provided
    if (updateData.price) {
      updateData.priceNum = parsePrice(updateData.price);
      updateData.price = `KES ${updateData.priceNum.toLocaleString()}`;
    }

    // Update the property
    const updatedProperty = await Property.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    console.log(`✅ Property updated: ${updatedProperty._id}`);

    res.json({
      success: true,
      data: updatedProperty,
      message: 'Property updated successfully'
    });

  } catch (err) {
    console.error('❌ Error in updateProperty:', err);
    
    // Clean up Cloudinary images if there's an error
    if (req.processedFiles && req.processedFiles.length > 0) {
      console.log('🧹 Cleaning up Cloudinary images due to error...');
      await Promise.all(
        req.processedFiles.map(file => 
          cloudinary.uploader.destroy(file.publicId)
            .catch(cleanupErr => 
              console.warn('Failed to cleanup Cloudinary image:', cleanupErr.message)
            )
        )
      );
    }
    
    // Handle validation errors
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to update property',
      error: process.env.NODE_ENV === 'production' ? 'Server error' : err.message
    });
  }
};

// ===================== DELETE IMAGE (CLOUDINARY VERSION) =====================
exports.deleteImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { publicId } = req.body;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'Cloudinary publicId is required'
      });
    }

    const property = await Property.findById(id);
    if (!property) {
      return res.status(404).json({ 
        success: false,
        message: 'Property not found' 
      });
    }

    // Delete from Cloudinary
    const cloudinaryResult = await cloudinary.uploader.destroy(publicId);
    
    if (cloudinaryResult.result !== 'ok') {
      console.warn(`⚠️ Cloudinary deletion returned: ${cloudinaryResult.result}`);
    }

    // Remove from arrays
    const initialImageCount = property.images.length;
    const initialPublicIdCount = property.cloudinaryPublicIds.length;
    
    property.images = property.images.filter(img => !img.includes(publicId));
    property.cloudinaryPublicIds = property.cloudinaryPublicIds.filter(pid => pid !== publicId);
    
    const imagesRemoved = initialImageCount - property.images.length;
    const publicIdsRemoved = initialPublicIdCount - property.cloudinaryPublicIds.length;

    if (imagesRemoved === 0) {
      return res.status(404).json({
        success: false,
        message: 'Image not found in property'
      });
    }

    await property.save();
    
    console.log(`🗑️ Deleted Cloudinary image: ${publicId}`);
    
    res.json({
      success: true,
      message: `Deleted ${imagesRemoved} image(s) from Cloudinary and database`,
      data: {
        images: property.images,
        cloudinaryPublicIds: property.cloudinaryPublicIds
      }
    });

  } catch (err) {
    console.error('❌ Error deleting image:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete image',
      error: process.env.NODE_ENV === 'production' ? 'Server error' : err.message
    });
  }
};

// ===================== DELETE PROPERTY (CLOUDINARY VERSION) =====================
exports.deleteProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ 
        success: false,
        message: 'Property not found' 
      });
    }

    // Delete all images from Cloudinary
    if (property.cloudinaryPublicIds && property.cloudinaryPublicIds.length > 0) {
      console.log(`🗑️ Deleting ${property.cloudinaryPublicIds.length} images from Cloudinary...`);
      
      const deletionResults = await Promise.allSettled(
        property.cloudinaryPublicIds.map(publicId => 
          cloudinary.uploader.destroy(publicId)
            .then(result => ({ publicId, result }))
            .catch(error => ({ publicId, error }))
        )
      );

      // Log results
      deletionResults.forEach(result => {
        if (result.status === 'fulfilled') {
          console.log(`✅ Deleted from Cloudinary: ${result.value.publicId}`);
        } else {
          console.warn(`⚠️ Failed to delete from Cloudinary:`, result.reason);
        }
      });
    }

    // Delete from database
    await property.deleteOne();
    
    console.log(`🗑️ Property deleted from database: ${req.params.id}`);
    
    res.json({
      success: true,
      message: 'Property deleted successfully from Cloudinary and database'
    });

  } catch (err) {
    console.error('❌ Error in deleteProperty:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete property',
      error: process.env.NODE_ENV === 'production' ? 'Server error' : err.message
    });
  }
};

// ===================== DEBUG ENDPOINT =====================
exports.debugInfo = async (req, res) => {
  try {
    const propertyCount = await Property.countDocuments();
    
    // Sample Cloudinary info
    let cloudinaryInfo = {};
    try {
      const resources = await cloudinary.api.resources({
        type: 'upload',
        prefix: 'propertybyfridah',
        max_results: 1
      });
      cloudinaryInfo = {
        totalResources: resources.total_count,
        rateLimitUsed: resources.rate_limit_allowed - resources.rate_limit_remaining,
        rateLimitAllowed: resources.rate_limit_allowed
      };
    } catch (cloudinaryErr) {
      cloudinaryInfo = { error: cloudinaryErr.message };
    }
    
    res.json({
      success: true,
      debug: {
        propertyCount,
        cloudinary: cloudinaryInfo,
        nodeEnv: process.env.NODE_ENV,
        mongoConnected: !!mongoose.connection.readyState,
        cloudinaryConfigured: !!process.env.CLOUDINARY_CLOUD_NAME
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};