// ================= IMPORTS & CONFIG =================
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const hpp = require('hpp');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['MONGODB_URI', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const missingEnvVars = requiredEnvVars.filter(env => !process.env[env]);

if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingEnvVars);
    console.error('Please check your .env file or Render environment variables.');
    process.exit(1);
}

// ================= INITIALIZE APP =================
const app = express();

// ================= CONFIGURATION =================
const NODE_ENV = process.env.NODE_ENV || 'production';
const IS_PRODUCTION = NODE_ENV === 'production';
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

console.log('🚀 =========== PROPERTY BY FRIDAH SERVER ===========');
console.log(`🔐 Environment: ${NODE_ENV}`);
console.log(`🌐 Port: ${PORT}`);
console.log(`📁 Working Directory: ${process.cwd()}`);
console.log('====================================================');

// ================= CLOUDINARY CONFIG =================
// Use CLOUDINARY_URL if available, otherwise use individual configs
if (process.env.CLOUDINARY_URL) {
    cloudinary.config({
        cloudinary_url: process.env.CLOUDINARY_URL
    });
    console.log('☁️  Cloudinary: Configured via CLOUDINARY_URL');
} else {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true
    });
    console.log('☁️  Cloudinary: Configured with individual credentials');
}

// ================= TRUST PROXY FOR RENDER =================
app.set('trust proxy', 1);

// ================= SECURITY MIDDLEWARE =================
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "blob:", "https:", "http:", "res.cloudinary.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            connectSrc: [
                "'self'",
                "https://*.render.com",
                "https://*.mongodb.net",
                "https://res.cloudinary.com",
                "https://property-by-fridah.onrender.com",
                "https://codewithkaranja.github.io",
                "http://localhost:3000",
                "ws://localhost:*"
            ],
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(xss());
app.use(hpp());

// ================= RATE LIMITING =================
const apiLimiter = rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW_MS ? parseInt(process.env.RATE_LIMIT_WINDOW_MS) : 15 * 60 * 1000,
    max: process.env.RATE_LIMIT_MAX_REQUESTS ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) : (IS_PRODUCTION ? 200 : 1000),
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    skip: (req) => {
        return req.path === '/health' || 
               req.path === '/api/health' ||
               req.path === '/api/version' ||
               req.path === '/api/cors-test';
    }
});

app.use(apiLimiter);

// ================= PERFORMANCE MIDDLEWARE =================
app.use(compression());

// ================= CORS CONFIGURATION =================
const corsOptions = {
    origin: [
        'https://propertybyfridah.com',
        'https://www.propertybyfridah.com',
        'https://property-by-fridah.onrender.com',
        'https://*.render.com',
        'https://codewithkaranja.github.io',
        'https://*.github.io',
        'http://localhost:3000',
        'http://localhost:5000',
        'http://localhost:5173',
        'http://localhost:8080'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    credentials: true,
    maxAge: 86400,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ================= BODY PARSING =================
app.use(express.json({ 
    limit: '50mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

app.use(express.urlencoded({ 
    extended: true, 
    limit: '50mb',
    parameterLimit: 10000
}));

// ================= STATIC FILE SERVING =================
const PUBLIC_DIR = path.join(process.cwd(), 'public');
if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    console.log(`📁 Created directory: ${PUBLIC_DIR}`);
} else {
    console.log(`📁 Public directory exists: ${PUBLIC_DIR}`);
}

app.use(express.static(PUBLIC_DIR, {
    maxAge: IS_PRODUCTION ? '1h' : '0',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        }
        if (filePath.match(/\.(js|css|woff2|woff|ttf)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));

// ================= CUSTOM MIDDLEWARE =================
// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    
    // Skip logging for health checks
    if (req.path === '/health' || req.path === '/api/health') {
        return next();
    }
    
    console.log(`📥 [${requestId}] ${req.method} ${req.originalUrl} - ${req.ip}`);
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        const statusEmoji = res.statusCode >= 500 ? '🚨' : res.statusCode >= 400 ? '⚠️' : '✅';
        console.log(`${statusEmoji} [${requestId}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    });
    
    next();
});

// ================= MULTER FOR MEMORY STORAGE =================
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { 
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 10 // Max 10 files
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed (jpeg, jpg, png, webp, gif)'));
        }
    }
});

// Cloudinary upload helper function
const uploadToCloudinary = (fileBuffer, folder = 'property-by-fridah') => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: folder,
                resource_type: 'auto',
                transformation: [
                    { width: 1200, height: 800, crop: 'limit' },
                    { quality: 'auto' },
                    { fetch_format: 'auto' }
                ]
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        
        uploadStream.end(fileBuffer);
    });
};

// ================= DATABASE CONNECTION =================
const connectWithRetry = async (retries = 5, delay = 5000) => {
    console.log(`🔗 Attempting MongoDB connection (${retries} retries)...`);
    
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`🔄 Attempt ${i + 1}/${retries}...`);
            
            await mongoose.connect(MONGODB_URI, {
                serverSelectionTimeoutMS: 15000,
                socketTimeoutMS: 45000,
                maxPoolSize: 10,
                minPoolSize: 2,
                connectTimeoutMS: 10000,
                retryWrites: true,
                w: 'majority'
            });
            
            console.log('✅ MongoDB connected successfully');
            console.log(`📊 Database: ${mongoose.connection.name}`);
            console.log(`📈 Host: ${mongoose.connection.host}`);
            
            return mongoose.connection;
        } catch (err) {
            console.error(`❌ MongoDB connection attempt ${i + 1} failed:`, err.message);
            
            if (err.message.includes('ENOTFOUND') || err.message.includes('whitelist')) {
                console.error('\n🚨 MONGODB ATLAS CONNECTION ISSUE 🚨');
                console.error('==========================================');
                console.error('Common causes:');
                console.error('1. IP not whitelisted in MongoDB Atlas');
                console.error('2. Network connectivity issue');
                console.error('3. Invalid MongoDB URI');
                console.error('==========================================\n');
            }
            
            if (i === retries - 1) {
                console.error('❌ Could not connect to MongoDB after maximum retries');
                throw err;
            } else {
                console.log(`🔄 Retrying in ${delay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
};

// ================= PROPERTY MODEL =================
const propertySchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    location: { 
        type: String, 
        required: [true, 'Location is required'],
        trim: true,
        lowercase: true
    },
    type: { 
        type: String, 
        required: [true, 'Property type is required'],
        enum: {
            values: ['house', 'apartment', 'land', 'commercial', 'bungalow', 'maisonette', 
                    'townhouse', 'studio', 'villa', 'office', 'shop', 'warehouse', 
                    'land-res', 'land-comm', 'ranch'],
            message: '{VALUE} is not a valid property type'
        }
    },
    status: { 
        type: String, 
        default: 'available',
        enum: ['available', 'sold', 'rented', 'pending', 'reserved']
    },
    transaction: {
        type: String,
        default: 'sale',
        enum: ['sale', 'rent', 'lease']
    },
    price: { 
        type: String, 
        required: [true, 'Price is required'],
        trim: true
    },
    priceNum: { 
        type: Number, 
        required: [true, 'Price number is required'],
        min: [0, 'Price must be positive']
    },
    bedrooms: { 
        type: Number, 
        default: 0,
        min: [0, 'Bedrooms cannot be negative']
    },
    bathrooms: { 
        type: Number, 
        default: 0,
        min: [0, 'Bathrooms cannot be negative']
    },
    parking: { 
        type: Number, 
        default: 0,
        min: [0, 'Parking cannot be negative']
    },
    size: { 
        type: String, 
        default: '',
        trim: true
    },
    description: { 
        type: String, 
        default: '',
        trim: true
    },
    whatsapp: { 
        type: String, 
        default: '254721911181',
        trim: true
    },
    images: { 
        type: [String], 
        default: [],
        validate: {
            validator: function(arr) {
                return arr.length <= 10;
            },
            message: 'Cannot have more than 10 images'
        }
    },
    features: { 
        type: [String], 
        default: []
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for better query performance
propertySchema.index({ location: 1, type: 1, status: 1 });
propertySchema.index({ priceNum: 1 });
propertySchema.index({ createdAt: -1 });

const Property = mongoose.model('Property', propertySchema);

// ================= API ENDPOINTS =================
// Add this BEFORE static file serving in server.js
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'PropertyByFridah API Server',
        endpoints: {
            properties: '/api/properties',
            health: '/api/health',
            version: '/api/version'
        },
        timestamp: new Date().toISOString()
    });
});
// Health check endpoints
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: 'PropertyByFridah API',
        environment: NODE_ENV,
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

app.get('/api/health', async (req, res) => {
    try {
        const dbStatus = mongoose.connection.readyState === 1;
        
        // Test Cloudinary connectivity
        let cloudinaryStatus = false;
        try {
            await cloudinary.api.ping();
            cloudinaryStatus = true;
        } catch (error) {
            console.warn('Cloudinary ping failed:', error.message);
        }
        
        const health = {
            success: true,
            status: dbStatus && cloudinaryStatus ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            uptime: {
                seconds: process.uptime(),
                formatted: `${Math.floor(process.uptime() / 60)}m ${Math.floor(process.uptime() % 60)}s`
            },
            services: {
                database: {
                    connected: dbStatus,
                    state: mongoose.connection.readyState,
                    name: mongoose.connection.name || 'Not connected'
                },
                cloudinary: {
                    connected: cloudinaryStatus,
                    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'Not configured'
                }
            },
            environment: NODE_ENV,
            version: '1.0.0'
        };
        
        res.json(health);
    } catch (error) {
        res.status(503).json({
            success: false,
            status: 'unhealthy',
            message: 'Health check failed',
            error: error.message
        });
    }
});

app.get('/api/version', (req, res) => {
    res.json({
        name: 'PropertyByFridah API',
        version: '1.0.0',
        environment: NODE_ENV,
        node: process.version,
        mongoose: mongoose.version,
        express: require('express/package.json').version,
        cloudinary: require('cloudinary').version,
        storage: 'cloudinary'
    });
});

// GET all properties
app.get('/api/properties', async (req, res) => {
    try {
        console.log('📊 Fetching properties...');
        
        // Build query
        let query = {};
        
        // Optional filtering by status
        if (req.query.status) {
            query.status = req.query.status;
        }
        
        // Optional filtering by transaction type
        if (req.query.transaction) {
            query.transaction = req.query.transaction;
        }
        
        // Optional filtering by type
        if (req.query.type) {
            query.type = req.query.type;
        }
        
        // Optional filtering by location
        if (req.query.location) {
            query.location = { $regex: new RegExp(req.query.location, 'i') };
        }
        
        const properties = await Property.find(query)
            .sort({ createdAt: -1 })
            .select('-__v');
        
        console.log(`✅ Found ${properties.length} properties`);
        res.json(properties);
    } catch (error) {
        console.error('❌ Error fetching properties:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch properties',
            error: error.message 
        });
    }
});

// GET single property by ID
app.get('/api/properties/:id', async (req, res) => {
    try {
        const property = await Property.findById(req.params.id).select('-__v');
        
        if (!property) {
            return res.status(404).json({ 
                success: false, 
                message: 'Property not found' 
            });
        }
        
        res.json(property);
    } catch (error) {
        console.error('❌ Error fetching property:', error);
        
        if (error.kind === 'ObjectId') {
            return res.status(400).json({
                success: false,
                message: 'Invalid property ID format'
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch property',
            error: error.message 
        });
    }
});

// POST create new property with images
app.post('/api/properties/add', upload.array('images', 10), async (req, res) => {
    try {
        console.log('🆕 Creating new property...');
        
        // Upload images to Cloudinary
        let uploadedImages = [];
        if (req.files && req.files.length > 0) {
            console.log(`📸 Uploading ${req.files.length} images to Cloudinary...`);
            
            for (const file of req.files) {
                try {
                    const result = await uploadToCloudinary(file.buffer);
                    uploadedImages.push(result.secure_url);
                    console.log(`✅ Uploaded image: ${result.public_id}`);
                } catch (uploadError) {
                    console.error('❌ Failed to upload image:', uploadError);
                    // Continue with other images
                }
            }
        }
        
        // Prepare property data
        const propertyData = {
            title: req.body.title,
            location: req.body.location,
            type: req.body.type,
            status: req.body.status || 'available',
            transaction: req.body.transaction || 'sale',
            price: req.body.price || `KES ${parseInt(req.body.priceNum || 0).toLocaleString()}`,
            priceNum: parseFloat(req.body.priceNum) || 0,
            bedrooms: parseInt(req.body.bedrooms) || 0,
            bathrooms: parseInt(req.body.bathrooms) || 0,
            parking: parseInt(req.body.parking) || 0,
            size: req.body.size || '',
            description: req.body.description || '',
            whatsapp: req.body.whatsapp || '254721911181',
            images: uploadedImages
        };
        
        // Validate required fields
        if (!propertyData.title || !propertyData.location || !propertyData.type || !propertyData.priceNum) {
            // Clean up uploaded images if validation fails
            if (uploadedImages.length > 0) {
                console.log('🧹 Cleaning up uploaded images due to validation error...');
                // Note: In production, you might want to actually delete these images
            }
            
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: title, location, type, price'
            });
        }
        
        // Create property
        const property = new Property(propertyData);
        await property.save();
        
        console.log(`✅ Property created: ${property.title} (ID: ${property._id})`);
        
        res.status(201).json({
            success: true,
            message: 'Property created successfully',
            property: property
        });
    } catch (error) {
        console.error('❌ Error creating property:', error);
        
        // Clean up uploaded images if error occurs
        if (req.files && req.files.length > 0) {
            console.log('🧹 Cleaning up uploaded images due to error...');
            // Note: In production, implement actual cleanup
        }
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: errors
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to create property',
            error: error.message
        });
    }
});

// PATCH update property
app.patch('/api/properties/:id', async (req, res) => {
    try {
        console.log(`✏️ Updating property ${req.params.id}...`);
        
        // Check if property exists
        const existingProperty = await Property.findById(req.params.id);
        if (!existingProperty) {
            return res.status(404).json({
                success: false,
                message: 'Property not found'
            });
        }
        
        // Prepare updates
        const updates = req.body;
        
        // Remove fields that shouldn't be updated
        delete updates._id;
        delete updates.createdAt;
        delete updates.__v;
        
        // Update timestamp
        updates.updatedAt = Date.now();
        
        // Update property
        const property = await Property.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        ).select('-__v');
        
        console.log(`✅ Property updated: ${property.title}`);
        res.json({
            success: true,
            message: 'Property updated successfully',
            property: property
        });
    } catch (error) {
        console.error('❌ Error updating property:', error);
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: errors
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to update property',
            error: error.message
        });
    }
});

// DELETE property
app.delete('/api/properties/:id', async (req, res) => {
    try {
        console.log(`🗑️ Deleting property ${req.params.id}...`);
        
        const property = await Property.findById(req.params.id);
        if (!property) {
            return res.status(404).json({
                success: false,
                message: 'Property not found'
            });
        }
        
        // Delete images from Cloudinary
        if (property.images && property.images.length > 0) {
            console.log(`🧹 Deleting ${property.images.length} images from Cloudinary...`);
            
            for (const imageUrl of property.images) {
                try {
                    // Extract public ID from URL
                    const urlParts = imageUrl.split('/');
                    const filename = urlParts[urlParts.length - 1];
                    const publicId = `property-by-fridah/${filename.split('.')[0]}`;
                    
                    await cloudinary.uploader.destroy(publicId);
                    console.log(`✅ Deleted image: ${publicId}`);
                } catch (deleteError) {
                    console.warn('⚠️ Failed to delete image from Cloudinary:', deleteError.message);
                }
            }
        }
        
        // Delete from database
        await Property.findByIdAndDelete(req.params.id);
        
        console.log(`✅ Property deleted: ${property.title}`);
        res.json({
            success: true,
            message: 'Property deleted successfully'
        });
    } catch (error) {
        console.error('❌ Error deleting property:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete property',
            error: error.message
        });
    }
});

// ================= TEST & DEBUG ENDPOINTS =================
app.get('/api/cors-test', (req, res) => {
    res.json({
        success: true,
        message: 'CORS test successful!',
        requestOrigin: req.get('origin'),
        timestamp: new Date().toISOString(),
        headers: {
            'access-control-allow-origin': res.get('Access-Control-Allow-Origin'),
            'access-control-allow-methods': res.get('Access-Control-Allow-Methods'),
            'access-control-allow-headers': res.get('Access-Control-Allow-Headers')
        }
    });
});

app.get('/api/debug/env', (req, res) => {
    const safeEnv = {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        MONGODB_URI_SET: !!process.env.MONGODB_URI,
        CLOUDINARY_CONFIGURED: !!process.env.CLOUDINARY_CLOUD_NAME,
        RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
        FRONTEND_URL: process.env.FRONTEND_URL
    };
    
    res.json(safeEnv);
});

// ================= SPA FALLBACK =================
app.get('*', (req, res) => {
    // Skip API routes and static files
    if (req.path.startsWith('/api/') || req.path.includes('.')) {
        return res.status(404).json({
            success: false,
            message: 'Endpoint not found',
            path: req.path,
            availableEndpoints: [
                '/api/properties',
                '/api/properties/:id',
                '/api/properties/add',
                '/api/health',
                '/api/version',
                '/api/cors-test'
            ]
        });
    }
    
    // Serve index.html for SPA routing
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.json({
            success: false,
            message: 'Welcome to PropertyByFridah API',
            api: {
                properties: '/api/properties',
                health: '/api/health',
                version: '/api/version',
                documentation: 'https://github.com/yourusername/property-by-fridah'
            }
        });
    }
});

// ================= ERROR HANDLING =================
app.use((err, req, res, next) => {
    console.error('🚨 Server Error:', {
        message: err.message,
        stack: IS_PRODUCTION ? undefined : err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip
    });
    
    // Handle specific error types
    if (err.name === 'MulterError') {
        return res.status(400).json({
            success: false,
            message: 'File upload error',
            error: err.code === 'LIMIT_FILE_SIZE' 
                ? 'File too large (max 5MB)' 
                : err.code === 'LIMIT_FILE_COUNT'
                ? 'Too many files (max 10)'
                : err.message
        });
    }
    
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: Object.values(err.errors).map(e => e.message)
        });
    }
    
    // Handle MongoDB duplicate key errors
    if (err.code === 11000) {
        return res.status(409).json({
            success: false,
            message: 'Duplicate entry',
            error: 'This record already exists'
        });
    }
    
    // Handle MongoDB CastError (invalid ObjectId)
    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: 'Invalid ID format',
            error: 'The provided ID is not valid'
        });
    }
    
    // General error
    res.status(err.status || 500).json({
        success: false,
        message: 'Internal server error',
        error: IS_PRODUCTION ? 'Something went wrong. Please try again later.' : err.message,
        ...(IS_PRODUCTION ? {} : { stack: err.stack })
    });
});

// ================= SERVER STARTUP =================
const startServer = async () => {
    try {
        console.log('\n🚀 Starting PropertyByFridah Server...');
        
        // Connect to MongoDB
        await connectWithRetry();
        
        // Start server
        const server = app.listen(PORT, '0.0.0.0', () => {
            const dbStatus = mongoose.connection.readyState === 1 
                ? '✅ CONNECTED' 
                : '❌ DISCONNECTED';
            
            console.log(`
✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨
🚀 PROPERTY BY FRIDAH ${IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT'} SERVER
✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨

✅ Server:    Running on port ${PORT} (0.0.0.0)
🌐 URL:       https://property-by-fridah.onrender.com
📁 Env:       ${NODE_ENV}
🗄️ Database:  ${dbStatus}
☁️  Storage:   Cloudinary (Images)

🔒 Security:  ✅ ENABLED
   - Trust Proxy: ✅ Configured for Render
   - Rate Limit: ${process.env.RATE_LIMIT_MAX_REQUESTS || 200} req/${parseInt(process.env.RATE_LIMIT_WINDOW_MS || 900000) / 60000}min
   - Helmet: Enabled
   - CORS: Configured for GitHub Pages

🌐 Frontend:  ${process.env.FRONTEND_URL || 'Not specified'}
🌐 Health:    https://property-by-fridah.onrender.com/health

📊 API Endpoints:
   - GET    /api/properties           - List all properties
   - POST   /api/properties/add       - Add new property
   - GET    /api/properties/:id       - Get property by ID
   - PATCH  /api/properties/:id       - Update property
   - DELETE /api/properties/:id       - Delete property
   - GET    /api/health               - Health check
   - GET    /api/version              - Version info

✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨
            `);
        });

        // Graceful shutdown
        const gracefulShutdown = async (signal) => {
            console.log(`\n🔻 Received ${signal}. Shutting down gracefully...`);
            
            server.close(async () => {
                console.log('✅ HTTP server closed');
                
                if (mongoose.connection.readyState === 1) {
                    await mongoose.connection.close(false);
                    console.log('✅ MongoDB connection closed');
                }
                
                console.log('✅ Server shutdown complete');
                process.exit(0);
            });
            
            // Force shutdown after 10 seconds
            setTimeout(() => {
                console.error('❌ Forcing shutdown after timeout');
                process.exit(1);
            }, 10000);
        };

        // Handle shutdown signals
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));

        // Handle uncaught errors
        process.on('uncaughtException', (err) => {
            console.error('🚨 Uncaught Exception:', err);
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
        });

        // Configure server timeouts
        server.keepAliveTimeout = 65000;
        server.headersTimeout = 66000;

        return server;
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Start the server
if (require.main === module) {
    startServer();
}

// Export for testing
module.exports = app;