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

console.log('🚀 =========== UNIPRO REAL ESTATE SERVER ===========');
console.log(`🔐 Environment: ${NODE_ENV}`);
console.log(`🌐 Port: ${PORT}`);
console.log(`📁 Working Directory: ${process.cwd()}`);
console.log('====================================================');

// ================= CLOUDINARY CONFIG =================
if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ cloudinary_url: process.env.CLOUDINARY_URL });
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
                "https://uniprorealestate.co.ke",
                "https://www.uniprorealestate.co.ke",
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
        'https://uniprorealestate.co.ke',
        'https://www.uniprorealestate.co.ke',
        'https://unipro-real-estate.onrender.com',
        'https://*.render.com',
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
    verify: (req, res, buf) => { req.rawBody = buf; }
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
    
    if (req.path === '/health' || req.path === '/api/health') return next();
    
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
        files: 10
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
const uploadToCloudinary = (fileBuffer, folder = 'unipro/listings') => {
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

// ================= LAND LISTING MODEL =================
const LandListing = require('./models/LandListing');

// ================= API ENDPOINTS =================
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Unipro Real Estate API Server (Land Only)',
        endpoints: {
            listings: '/api/listings',
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
        service: 'Unipro Real Estate API',
        environment: NODE_ENV,
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

app.get('/api/health', async (req, res) => {
    try {
        const dbStatus = mongoose.connection.readyState === 1;
        
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
        name: 'Unipro Real Estate API',
        version: '1.0.0',
        environment: NODE_ENV,
        node: process.version,
        mongoose: mongoose.version,
        express: require('express/package.json').version,
        cloudinary: require('cloudinary').version,
        storage: 'cloudinary'
    });
});

// GET all listings
app.get('/api/listings', async (req, res) => {
    try {
        console.log('📊 Fetching listings...');
        
        let query = {};
        
        if (req.query.status) query.status = req.query.status;
        if (req.query.type) query.type = req.query.type;
        if (req.query.location) {
            query.location = { $regex: new RegExp(req.query.location, 'i') };
        }
        
        const listings = await LandListing.find(query)
            .sort({ createdAt: -1 })
            .select('-__v');
        
        console.log(`✅ Found ${listings.length} listings`);
        res.json(listings);
    } catch (error) {
        console.error('❌ Error fetching listings:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch listings',
            error: error.message 
        });
    }
});

// GET single listing by ID
app.get('/api/listings/:id', async (req, res) => {
    try {
        const listing = await LandListing.findById(req.params.id).select('-__v');
        
        if (!listing) {
            return res.status(404).json({ 
                success: false, 
                message: 'Listing not found' 
            });
        }
        
        res.json(listing);
    } catch (error) {
        console.error('❌ Error fetching listing:', error);
        
        if (error.kind === 'ObjectId') {
            return res.status(400).json({
                success: false,
                message: 'Invalid listing ID format'
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch listing',
            error: error.message 
        });
    }
});

// POST create new listing with images
app.post('/api/listings/add', upload.array('images', 10), async (req, res) => {
    try {
        console.log('🆕 Creating new listing...');
        
        // Upload images to Cloudinary
        let uploadedImages = [];
        let publicIds = [];
        if (req.files && req.files.length > 0) {
            console.log(`📸 Uploading ${req.files.length} images to Cloudinary...`);
            
            for (const file of req.files) {
                try {
                    const result = await uploadToCloudinary(file.buffer, 'unipro/listings');
                    uploadedImages.push(result.secure_url);
                    publicIds.push(result.public_id);
                    console.log(`✅ Uploaded image: ${result.public_id}`);
                } catch (uploadError) {
                    console.error('❌ Failed to upload image:', uploadError);
                }
            }
        }
        
        // Prepare listing data (land-only)
        const listingData = {
            title: req.body.title,
            location: req.body.location,
            type: req.body.type,
            status: req.body.status || 'available',
            price: req.body.price || `KES ${parseInt(req.body.priceNum || 0).toLocaleString()}`,
            priceNum: parseFloat(req.body.priceNum) || 0,
            plotSize: req.body.plotSize || req.body.size || '',
            titleType: req.body.titleType || '',
            description: req.body.description || '',
            whatsapp: req.body.whatsapp || '254704564880',
            images: uploadedImages,
            cloudinaryPublicIds: publicIds,
            amenities: req.body.amenities ? (Array.isArray(req.body.amenities) ? req.body.amenities : JSON.parse(req.body.amenities)) : [],
            verificationChecklist: req.body.verificationChecklist ? JSON.parse(req.body.verificationChecklist) : [],
            documentsAvailable: req.body.documentsAvailable ? JSON.parse(req.body.documentsAvailable) : [],
            mapLink: req.body.mapLink || ''
        };
        
        // Validate required fields
        if (!listingData.title || !listingData.location || !listingData.type || !listingData.priceNum) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: title, location, type, price'
            });
        }
        
        const listing = new LandListing(listingData);
        await listing.save();
        
        console.log(`✅ Listing created: ${listing.title} (ID: ${listing._id})`);
        
        res.status(201).json({
            success: true,
            message: 'Listing created successfully',
            listing: listing
        });
    } catch (error) {
        console.error('❌ Error creating listing:', error);
        
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
            message: 'Failed to create listing',
            error: error.message
        });
    }
});

// PATCH update listing
app.patch('/api/listings/:id', async (req, res) => {
    try {
        console.log(`✏️ Updating listing ${req.params.id}...`);
        
        const existingListing = await LandListing.findById(req.params.id);
        if (!existingListing) {
            return res.status(404).json({
                success: false,
                message: 'Listing not found'
            });
        }
        
        const updates = req.body;
        delete updates._id;
        delete updates.createdAt;
        delete updates.__v;
        updates.updatedAt = Date.now();
        
        // Parse arrays if they come as strings
        if (updates.amenities && typeof updates.amenities === 'string') {
            updates.amenities = JSON.parse(updates.amenities);
        }
        if (updates.verificationChecklist && typeof updates.verificationChecklist === 'string') {
            updates.verificationChecklist = JSON.parse(updates.verificationChecklist);
        }
        if (updates.documentsAvailable && typeof updates.documentsAvailable === 'string') {
            updates.documentsAvailable = JSON.parse(updates.documentsAvailable);
        }
        
        const listing = await LandListing.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        ).select('-__v');
        
        console.log(`✅ Listing updated: ${listing.title}`);
        res.json({
            success: true,
            message: 'Listing updated successfully',
            listing: listing
        });
    } catch (error) {
        console.error('❌ Error updating listing:', error);
        
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
            message: 'Failed to update listing',
            error: error.message
        });
    }
});

// DELETE listing
app.delete('/api/listings/:id', async (req, res) => {
    try {
        console.log(`🗑️ Deleting listing ${req.params.id}...`);
        
        const listing = await LandListing.findById(req.params.id);
        if (!listing) {
            return res.status(404).json({
                success: false,
                message: 'Listing not found'
            });
        }
        
        // Delete images from Cloudinary
        if (listing.cloudinaryPublicIds && listing.cloudinaryPublicIds.length > 0) {
            console.log(`🧹 Deleting ${listing.cloudinaryPublicIds.length} images from Cloudinary...`);
            
            for (const publicId of listing.cloudinaryPublicIds) {
                try {
                    await cloudinary.uploader.destroy(publicId);
                    console.log(`✅ Deleted image: ${publicId}`);
                } catch (deleteError) {
                    console.warn('⚠️ Failed to delete image from Cloudinary:', deleteError.message);
                }
            }
        }
        
        await LandListing.findByIdAndDelete(req.params.id);
        
        console.log(`✅ Listing deleted: ${listing.title}`);
        res.json({
            success: true,
            message: 'Listing deleted successfully'
        });
    } catch (error) {
        console.error('❌ Error deleting listing:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete listing',
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
    if (req.path.startsWith('/api/') || req.path.includes('.')) {
        return res.status(404).json({
            success: false,
            message: 'Endpoint not found',
            path: req.path,
            availableEndpoints: [
                '/api/listings',
                '/api/listings/:id',
                '/api/listings/add',
                '/api/health',
                '/api/version',
                '/api/cors-test'
            ]
        });
    }
    
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.json({
            success: false,
            message: 'Welcome to Unipro Real Estate API',
            api: {
                listings: '/api/listings',
                health: '/api/health',
                version: '/api/version'
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
    
    if (err.code === 11000) {
        return res.status(409).json({
            success: false,
            message: 'Duplicate entry',
            error: 'This record already exists'
        });
    }
    
    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: 'Invalid ID format',
            error: 'The provided ID is not valid'
        });
    }
    
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
        console.log('\n🚀 Starting Unipro Real Estate Server...');
        
        await connectWithRetry();
        
        const server = app.listen(PORT, '0.0.0.0', () => {
            const dbStatus = mongoose.connection.readyState === 1 
                ? '✅ CONNECTED' 
                : '❌ DISCONNECTED';
            
            console.log(`
✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨
🚀 UNIPRO REAL ESTATE ${IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT'} SERVER
✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨

✅ Server:    Running on port ${PORT} (0.0.0.0)
🌐 URL:       https://unipro-real-estate.onrender.com
📁 Env:       ${NODE_ENV}
🗄️ Database:  ${dbStatus}
☁️  Storage:   Cloudinary (Images)

🔒 Security:  ✅ ENABLED
   - Trust Proxy: ✅ Configured for Render
   - Rate Limit: ${process.env.RATE_LIMIT_MAX_REQUESTS || 200} req/${parseInt(process.env.RATE_LIMIT_WINDOW_MS || 900000) / 60000}min
   - Helmet: Enabled
   - CORS: Configured for uniprorealestate.co.ke

🌐 Frontend:  ${process.env.FRONTEND_URL || 'https://uniprorealestate.co.ke'}
🌐 Health:    https://unipro-real-estate.onrender.com/health

📊 API Endpoints:
   - GET    /api/listings           - List all land listings
   - POST   /api/listings/add       - Add new listing
   - GET    /api/listings/:id       - Get listing by ID
   - PATCH  /api/listings/:id       - Update listing
   - DELETE /api/listings/:id       - Delete listing
   - GET    /api/health               - Health check
   - GET    /api/version              - Version info

✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨
            `);
        });

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
            
            setTimeout(() => {
                console.error('❌ Forcing shutdown after timeout');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));

        process.on('uncaughtException', (err) => {
            console.error('🚨 Uncaught Exception:', err);
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
        });

        server.keepAliveTimeout = 65000;
        server.headersTimeout = 66000;

        return server;
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

if (require.main === module) {
    startServer();
}

module.exports = app;