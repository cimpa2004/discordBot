const AWS = require("aws-sdk");

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

/**
 * Get a signed S3 URL for a sound file
 * @param {string} key - The S3 object key (e.g., 'mysound.mp3')
 * @param {number} expires - Expiry in seconds (default: 60)
 * @returns {string} Signed URL
 */
function getSignedSoundUrl(key, expires = 60) {
  return s3.getSignedUrl("getObject", {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Expires: expires,
  });
}

module.exports = { getSignedSoundUrl };
