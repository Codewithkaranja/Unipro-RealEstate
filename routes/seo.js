// routes/seo.js
const express = require('express');
const router = express.Router();
const LandListing = require('../models/LandListing');

function parseAcreSize(sizeStr) {
  if (!sizeStr) return null;
  const frac = sizeStr.match(/(\d+)\/(\d+)/);
  if (frac) return parseInt(frac[1]) / parseInt(frac[2]);
  const num = sizeStr.match(/([\d.]+)/);
  return num ? parseFloat(num[1]) : null;
}

function getAvailability(status) {
  if (!status) return "https://schema.org/InStock";
  switch (status.toLowerCase()) {
    case "sold": return "https://schema.org/SoldOut";
    case "reserved": return "https://schema.org/Reserved";
    default: return "https://schema.org/InStock";
  }
}

function mapListingType(type) {
  // All land types are best represented as LandParcel
  return "LandParcel";
}

router.get('/jsonld', async (req, res) => {
  try {
    const listings = await LandListing.find();

    const graph = [];

    // 🔹 Agent node (Unipro Consultants Ltd)
    graph.push({
      "@type": "RealEstateAgent",
      "@id": "https://uniprorealestate.co.ke/#agent",
      "name": "Unipro Consultants Ltd",
      "url": "https://uniprorealestate.co.ke",
      "logo": "https://uniprorealestate.co.ke/logo.png", // Replace with actual logo path
      "telephone": "+254704564880",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Kitengela",
        "addressCountry": "KE"
      }
    });

    // 🔹 Listing nodes
    listings.forEach(l => {
      const schemaType = mapListingType(l.type);
      const images = Array.isArray(l.images) ? l.images : [];

      // Construct the canonical URL for this listing
      // Adjust if your frontend uses a different pattern
      const listingUrl = `https://uniprorealestate.co.ke/properties.html?id=${l._id}`;

      graph.push({
        "@type": schemaType,
        "@id": listingUrl,
        "name": l.title,
        "description": l.description || '',
        "image": images,
        "address": {
          "@type": "PostalAddress",
          "addressLocality": l.location,
          "addressCountry": "KE"
        },
        // Plot size in acres (if parseable)
        ...(l.plotSize ? {
          "floorSize": {
            "@type": "QuantitativeValue",
            "value": parseAcreSize(l.plotSize),
            "unitCode": "ACR"
          }
        } : {}),
        "offers": {
          "@type": "Offer",
          "price": l.price,
          "priceCurrency": "KES",
          "availability": getAvailability(l.status),
          "seller": { "@id": "https://uniprorealestate.co.ke/#agent" }
        },
        // Timestamps for Google
        ...(l.createdAt ? { "datePosted": l.createdAt.toISOString() } : {}),
        ...(l.updatedAt ? { "dateModified": l.updatedAt.toISOString() } : {})
      });
    });

    res.json({
      "@context": "https://schema.org",
      "@graph": graph
    });
  } catch (error) {
    console.error('SEO JSON-LD generation error:', error);
    res.status(500).json({ error: 'Failed to generate structured data' });
  }
});

module.exports = router;