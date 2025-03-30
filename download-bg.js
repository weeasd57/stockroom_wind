const https = require('https');
const fs = require('fs');
const path = require('path');

// URL for a free stock trading background from Pixabay
const imageUrl = 'https://cdn.pixabay.com/photo/2021/03/16/21/49/stock-trading-6100961_1280.jpg';
const outputPath = path.join(__dirname, 'public', 'trading-bg.jpg');

console.log(`Downloading trading background image to ${outputPath}...`);

https.get(imageUrl, (response) => {
  if (response.statusCode !== 200) {
    console.error(`Failed to download image: ${response.statusCode} ${response.statusMessage}`);
    return;
  }
  
  const file = fs.createWriteStream(outputPath);
  response.pipe(file);
  
  file.on('finish', () => {
    file.close();
    console.log('Background image downloaded successfully!');
  });
  
  file.on('error', (err) => {
    fs.unlink(outputPath);
    console.error(`Error writing file: ${err.message}`);
  });
}).on('error', (err) => {
  console.error(`Error downloading image: ${err.message}`);
});
