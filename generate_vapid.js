const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

const vapidKeys = webpush.generateVAPIDKeys();

const envVars = `\n# VAPID Keys for Web Push Notifications\nVAPID_PUBLIC_KEY=${vapidKeys.publicKey}\nVAPID_PRIVATE_KEY=${vapidKeys.privateKey}\nVAPID_SUBJECT=mailto:admin@axecode.com\n`;

const envPath = path.join(__dirname, '.env');
fs.appendFileSync(envPath, envVars);

console.log('Successfully generated and appended VAPID keys to .env File');
console.log('Public Key: ', vapidKeys.publicKey);
