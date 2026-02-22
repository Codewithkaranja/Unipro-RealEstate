const mongoose = require('mongoose');
const Property = require('./models/Property'); // adjust path if needed

// MongoDB connection
mongoose.connect(
  'mongodb+srv://propertybyfridah:%23Fridah254@cluster0.joar9ei.mongodb.net/propertyByFridahDB?retryWrites=true&w=majority',
  {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }
)
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

// Base URL for images
const baseUrl = 'https://propertybyfridah.com/images/';

async function generateJsonLd() {
  const properties = await Property.find();

  const graph = properties.map(prop => {
    // Determine type
    let type = 'House';
    if ((prop.type || '').toLowerCase() === 'plot') type = 'LandParcel';
    if ((prop.type || '').toLowerCase() === 'apartment') type = 'Apartment';

    return {
      "@type": type,
      "name": prop.title,
      "description": prop.description,
      "image": prop.images.map(img => baseUrl + img),
      "address": {
        "@type": "PostalAddress",
        "addressLocality": prop.location,
        "addressCountry": "KE"
      },
      ...(prop.bedrooms ? { "numberOfRooms": prop.bedrooms } : {}),
      ...(prop.size ? {
        "floorSize": {
          "@type": "QuantitativeValue",
          "value": parseAcreSize(prop.size),
          "unitCode": "ACR"
        }
      } : {}),
      "offers": {
        "@type": "Offer",
        "price": prop.price,
        "priceCurrency": "KES",
        "availability": getAvailability(prop.status),
        "seller": {
          "@type": "RealEstateAgent",
          "name": "Property by Fridah"
        }
      }
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
