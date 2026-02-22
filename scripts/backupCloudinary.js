// scripts/backupCloudinary.js
require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const fs = require('fs').promises;
const path = require('path');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function backupCloudinaryResources() {
  const backupDir = path.join(__dirname, '../backups', new Date().toISOString().split('T')[0]);
  await fs.mkdir(backupDir, { recursive: true });
  
  let resources = [];
  let nextCursor = null;
  
  do {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'unipro', // Updated from 'propertybyfridah' to 'unipro'
      max_results: 500,
      next_cursor: nextCursor
    });
    
    resources = resources.concat(result.resources);
    nextCursor = result.next_cursor;
    console.log(`Fetched ${result.resources.length} resources, total: ${resources.length}`);
  } while (nextCursor);
  
  // Save to JSON file
  const backupFile = path.join(backupDir, 'cloudinary-backup.json');
  await fs.writeFile(backupFile, JSON.stringify(resources, null, 2));
  
  console.log(`✅ Backup completed: ${resources.length} resources saved to ${backupFile}`);
}

backupCloudinaryResources().catch(console.error);