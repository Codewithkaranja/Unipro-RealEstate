// generateJsonLd.js
const mongoose = require('mongoose');
const LandListing = require('./models/LandListing'); // adjust path if needed

// MongoDB connection – update with your actual credentials
const MONGODB_URI = 'mongodb+srv://uniprorealestate_db_user:%23Unipro2026@cluster0.mqrczsc.mongodb.net/uniprorealestateDB?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Helper: convert sizes like "1/8 Acre" to numeric value
function parseAcreSize(sizeStr) {
  if (!sizeStr) return null;
  const fracMatch = sizeStr.match(/(\d+)\/(\d+)/); // e.g., "1/8"
  if (fracMatch) return parseInt(fracMatch[1]) / parseInt(fracMatch[2]);
  const numMatch = sizeStr.match(/([\d.]+)/);
  if (numMatch) return parseFloat(numMatch[1]);
  return null;
}

// Helper: map status to schema.org availability
function getAvailability(status) {
  switch ((status || '').toLowerCase()) {
    case 'available': return 'https://schema.org/InStock';
    case 'sold': return 'https://schema.org/SoldOut';
    case 'reserved': return 'https://schema.org/Reserved';
    default: return 'https://schema.org/InStock';
  }
}

async function generateJsonLd() {
  const listings = await LandListing.find();

  const graph = listings.map(listing => {
    // All land types map to LandParcel
    const type = 'LandParcel';

    // Use stored image URLs directly (they are full Cloudinary URLs)
    const images = Array.isArray(listing.images) ? listing.images : [];

    return {
      "@type": type,
      "name": listing.title,
      "description": listing.description,
      "image": images,
      "address": {
        "@type": "PostalAddress",
        "addressLocality": listing.location,
        "addressCountry": "KE"
      },
      // Use plotSize for floorSize (if available)
      ...(listing.plotSize ? {
        "floorSize": {
          "@type": "QuantitativeValue",
          "value": parseAcreSize(listing.plotSize),
          "unitCode": "ACR"
        }
      } : {}),
      "offers": {
        "@type": "Offer",
        "price": listing.price,
        "priceCurrency": "KES",
        "availability": getAvailability(listing.status),
        "seller": {
          "@type": "RealEstateAgent",
          "name": "Unipro Consultants Ltd",
          "url": "https://uniprorealestate.co.ke"
        }
      },
      // Include timestamps if available
      ...(listing.createdAt ? { "datePosted": listing.createdAt.toISOString() } : {}),
      ...(listing.updatedAt ? { "dateModified": listing.updatedAt.toISOString() } : {})
    };
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": graph
  };

  console.log(JSON.stringify(jsonLd, null, 2));
  mongoose.connection.close();
}

generateJsonLd();