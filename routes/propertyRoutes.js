// routes/listingsRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cloudinary = require('cloudinary').v2;
const { body, param, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

// ================= RATE LIMITING =================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply to all routes
router.use(apiLimiter);

// More aggressive limiter for uploads
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many upload requests, please try again later.'
  }
});

// ================= CLOUDINARY CONFIG =================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ================= VALIDATION SCHEMAS (LAND-ONLY) =================
const listingValidation = [
  body('title').notEmpty().trim().withMessage('Title is required'),
  body('location').notEmpty().trim().withMessage('Location is required'),
  body('type')
    .notEmpty()
    .isIn(['land-res', 'land-comm', 'ranch', 'plot', 'subdivision-ready', 'title-deed-ready'])
    .withMessage('Valid land type is required'),
  body('price').notEmpty().withMessage('Price is required'),
  body('priceNum').isNumeric().withMessage('Price must be a number'),
  body('plotSize').notEmpty().trim().withMessage('Plot size is required'),
  body('titleType').optional().trim(),
  body('status').isIn(['available', 'sold', 'reserved']).withMessage('Valid status is required'),
  body('whatsapp').optional().isMobilePhone().withMessage('Valid WhatsApp number required'),
  body('amenities').optional().isArray(),
  body('verificationChecklist').optional().isArray(),
  body('documentsAvailable').optional().isArray(),
  body('mapLink').optional().isURL().withMessage('Map link must be a valid URL'),
];

const idValidation = [
  param('id').isMongoId().withMessage('Valid MongoDB ID required')
];

// ================= STREAMING UPLOAD TO CLOUDINARY =================
const uploadToCloudinary = (buffer, folder = 'unipro/listings') => {
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
          console.error('Cloudinary upload error:', {
            message: error.message,
            http_code: error.http_code,
            name: error.name
          });
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    stream.end(buffer);
  });
};

// ================= MEMORY-EFFICIENT FILE HANDLING =================
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 5,
    parts: 20
  }
});

// ================= ENHANCED CLOUDINARY UPLOAD MIDDLEWARE =================
const processUploadedImages = async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next();
  }

  console.log(`📤 Processing ${req.files.length} files for Cloudinary upload`);

  try {
    const uploadPromises = req.files.map(async (file, index) => {
      try {
        if (!file.buffer || file.buffer.length === 0) {
          throw new Error(`File ${index + 1} is empty`);
        }
        if (file.buffer.length > 5 * 1024 * 1024) {
          throw new Error(`File ${index + 1} exceeds 5MB limit`);
        }

        console.log(`🔄 Uploading file ${index + 1} (${(file.buffer.length / 1024 / 1024).toFixed(2)}MB)`);
        
        const result = await uploadToCloudinary(file.buffer, 'unipro/listings');
        
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
        console.error(`❌ Failed to upload file ${index + 1}:`, {
          name: file.originalname,
          size: file.size,
          error: uploadError.message
        });
        return null;
      }
    });

    const results = await Promise.all(uploadPromises);
    req.processedFiles = results.filter(result => result !== null);
    
    if (req.processedFiles.length === 0 && req.files.length > 0) {
      console.warn('⚠️ All file uploads failed');
      return res.status(400).json({
        success: false,
        message: 'Failed to upload any images. Please try again.',
        details: 'Cloudinary upload failed for all files'
      });
    }

    console.log(`🎉 Successfully uploaded ${req.processedFiles.length}/${req.files.length} files`);
    next();
  } catch (error) {
    console.error('🚨 Image processing middleware error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    if (error.message.includes('timeout')) {
      return res.status(408).json({
        success: false,
        message: 'Upload timeout. Please try smaller files.',
        code: 'UPLOAD_TIMEOUT'
      });
    }

    if (error.message.includes('File size too large')) {
      return res.status(413).json({
        success: false,
        message: 'File too large. Maximum size is 5MB per file.',
        code: 'FILE_TOO_LARGE'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to process images',
      code: 'IMAGE_PROCESSING_ERROR',
      detail: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
};

// ================= CONTROLLERS (to be updated) =================
// These controllers should be updated to use the LandListing model and new fields.
// For now we import them (they need to be adjusted separately)
const {
  addListing,
  getListings,
  getListingById,
  updateListing,
  deleteListing,
  deleteImage,
  debugInfo
} = require('../Controllers/listingController'); // <-- rename from propertyController

// ================= ERROR HANDLER =================
const handleControllerError = (controllerFn) => async (req, res, next) => {
  try {
    await controllerFn(req, res, next);
  } catch (error) {
    console.error('🚨 Controller Error:', {
      path: req.path,
      method: req.method,
      errorName: error.name,
      errorMessage: error.message,
      timestamp: new Date().toISOString()
    });

    const errorResponses = {
      ValidationError: () => res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: Object.values(error.errors).map(e => e.message)
      }),
      MongoError: () => error.code === 11000 ? res.status(409).json({
        success: false,
        message: 'Duplicate entry found',
        code: 'DUPLICATE_KEY'
      }) : res.status(500).json({
        success: false,
        message: 'Database error',
        code: 'MONGO_ERROR'
      }),
      MulterError: () => res.status(400).json({
        success: false,
        message: error.message,
        code: 'UPLOAD_ERROR'
      }),
      default: () => res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message })
      })
    };

    const handler = errorResponses[error.name] || errorResponses.default;
    handler();
  }
};

// ================= HEALTH & INFO =================
router.get('/health', (req, res) => {
  cloudinary.api.ping()
    .then(result => {
      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        services: {
          cloudinary: 'connected',
          database: 'connected',
          uploads: 'cloudinary-only'
        },
        limits: {
          fileSize: '5MB',
          maxFiles: '5',
          rateLimit: '100 requests/15min'
        }
      });
    })
    .catch(cloudinaryError => {
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          cloudinary: 'disconnected',
          error: cloudinaryError.message
        }
      });
    });
});

router.get('/info', async (req, res) => {
  try {
    const LandListing = require('../models/LandListing');
    const listingCount = await LandListing.countDocuments();
    
    const cloudinaryInfo = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'unipro/listings',
      max_results: 1
    });
    
    res.json({
      success: true,
      data: {
        listings: listingCount,
        cloudinary: {
          total: cloudinaryInfo.total_count,
          used: `${(cloudinaryInfo.rate_limit_allowed - cloudinaryInfo.rate_limit_remaining)}/${cloudinaryInfo.rate_limit_allowed} requests used`
        },
        server: {
          node: process.version,
          environment: process.env.NODE_ENV,
          uptime: `${process.uptime().toFixed(0)} seconds`,
          memory: {
            rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
            heap: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`
          }
        }
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get server info',
      code: 'INFO_ERROR'
    });
  }
});

// ================= SAMPLE DATA =================
router.post('/sample', uploadLimiter, async (req, res) => {
  try {
    const LandListing = require('../models/LandListing');
    
    const existingSample = await LandListing.findOne({ title: "1/8 Acre Plot – Katoloni, Machakos" });
    if (existingSample) {
      return res.status(409).json({
        success: false,
        message: 'Sample listing already exists',
        listingId: existingSample._id
      });
    }
    
    const sampleListing = new LandListing({
      title: "1/8 Acre Plot – Katoloni, Machakos",
      location: "Katoloni",
      type: "land-res",
      price: "KES 350,000",
      priceNum: 350000,
      plotSize: "1/8 acre",
      titleType: "Freehold",
      status: "available",
      description: "Prime residential plot with title deed ready. Near tarmac road.",
      whatsapp: "254704564880",
      images: [
        "https://res.cloudinary.com/demo/image/upload/v123/sample-plot.jpg"
      ],
      amenities: ["Water nearby", "Electricity", "Gated community"],
      verificationChecklist: [
        "certificate-of-search",
        "registry-index-map",
        "ground-confirmation",
        "id-confirmation",
        "agreement-to-sale",
        "transfer"
      ],
      documentsAvailable: ["Title deed", "Survey map"],
      mapLink: "https://goo.gl/maps/sample"
    });
    
    await sampleListing.save();
    
    res.status(201).json({
      success: true,
      message: 'Sample listing created',
      listing: {
        id: sampleListing._id,
        title: sampleListing.title,
        location: sampleListing.location
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create sample listing',
      code: 'SAMPLE_ERROR'
    });
  }
});

// ================= DEBUG ROUTES =================
router.get('/debug/cloudinary', async (req, res) => {
  try {
    const resources = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'unipro',
      max_results: 10
    });
    
    res.json({
      success: true,
      cloudinary: {
        total: resources.total_count,
        resources: resources.resources.map(r => ({
          public_id: r.public_id,
          url: r.secure_url,
          format: r.format,
          bytes: r.bytes
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/debug/info', handleControllerError(debugInfo));

router.post('/test/upload', uploadLimiter, upload.array('images', 2), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }
    
    const uploadResults = await Promise.all(
      req.files.map(file => uploadToCloudinary(file.buffer, 'unipro/test'))
    );
    
    res.json({
      success: true,
      message: 'Test upload successful',
      uploaded: uploadResults.map(r => ({
        url: r.secure_url,
        public_id: r.public_id,
        size: `${(r.bytes / 1024).toFixed(2)}KB`
      })),
      note: 'These are test files and will be automatically deleted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ================= MAIN API ROUTES =================

// GET all listings
router.get('/', handleControllerError(getListings));

// GET single listing with validation
router.get('/:id', idValidation, handleControllerError(getListingById));

// POST add new listing with validation
router.post('/add',
  uploadLimiter,
  upload.array('images', 5),
  processUploadedImages,
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  },
  listingValidation,
  handleControllerError(async (req, res) => {
    console.log('📝 Adding new listing');
    console.log(`🖼️ Images to attach: ${req.processedFiles?.length || 0}`);
    
    await addListing(req, res);
  })
);

// PUT update listing with validation
router.put('/:id',
  uploadLimiter,
  upload.array('images', 5),
  processUploadedImages,
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  },
  idValidation,
  listingValidation.map(validation => validation.optional()), // All fields optional for update
  handleControllerError(async (req, res) => {
    console.log(`📝 Updating listing ${req.params.id}`);
    console.log(`🖼️ New images to add: ${req.processedFiles?.length || 0}`);
    
    await updateListing(req, res);
  })
);

// DELETE image from listing
router.delete('/:id/image',
  idValidation,
  [body('publicId').notEmpty().withMessage('Cloudinary publicId is required')],
  handleControllerError(deleteImage)
);

// DELETE listing
router.delete('/:id',
  idValidation,
  handleControllerError(deleteListing)
);

// ================= CLEANUP ROUTE (ADMIN) =================
router.post('/admin/cleanup', async (req, res) => {
  const adminToken = req.headers['x-admin-token'];
  if (adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized'
    });
  }
  
  try {
    const result = await cloudinary.api.delete_resources_by_prefix('unipro/test');
    res.json({
      success: true,
      message: 'Cleanup completed',
      deleted: result.deleted
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;