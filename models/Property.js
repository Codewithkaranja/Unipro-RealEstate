const mongoose = require('mongoose');

const landListingSchema = new mongoose.Schema({
  // Core fields
  title: {
    type: String,
    required: [true, 'Listing title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true,
    index: true
  },
  type: {
    type: String,
    required: [true, 'Land type is required'],
    enum: ['land-res', 'land-comm', 'ranch', 'plot', 'subdivision-ready', 'title-deed-ready'],
    lowercase: true,
    index: true
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: ['available', 'sold', 'reserved'],
    default: 'available',
    lowercase: true,
    index: true
  },

  // Price handling
  price: {
    type: String,
    required: [true, 'Price display string is required']
  },
  priceNum: {
    type: Number,
    required: [true, 'Numeric price is required'],
    min: [0, 'Price must be positive'],
    index: true
  },

  // Land-specific details
  plotSize: {
    type: String,
    required: [true, 'Plot size is required'],
    trim: true
  },
  titleType: {
    type: String,
    trim: true,
    default: ''
  },
  amenities: [{
    type: String,
    trim: true
  }],
  verificationChecklist: [{
    type: String,
    trim: true
  }],
  documentsAvailable: [{
    type: String,
    trim: true
  }],
  mapLink: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || v.startsWith('http://') || v.startsWith('https://');
      },
      message: 'Map link must be a valid URL'
    }
  },

  // Description and contact
  description: {
    type: String,
    trim: true,
    default: ''
  },
  whatsapp: {
    type: String,
    required: [true, 'WhatsApp number is required'],
    trim: true,
    match: [/^\d{10,15}$/, 'Please enter a valid phone number (digits only)']
  },

  // Images
  images: [{
    type: String, // Cloudinary URLs
    validate: {
      validator: function(v) {
        return v.includes('cloudinary.com') || v.startsWith('http');
      },
      message: 'Image must be a valid URL'
    }
  }],
  cloudinaryPublicIds: [{
    type: String // For cleanup when deleting images
  }],

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound indexes for common filter combinations
landListingSchema.index({ location: 1, type: 1, status: 1 });
landListingSchema.index({ priceNum: 1 });
landListingSchema.index({ createdAt: -1 });

// Update timestamp on save
landListingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const LandListing = mongoose.model('LandListing', landListingSchema);

module.exports = LandListing;