const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Get a signed S3 URL for a sound file
 * @param {string} key - The S3 object key (e.g., 'mysound.mp3')
 * @param {number} expires - Expiry in seconds (default: 60)
 * @returns {Promise<string>} Signed URL
 */
function getSignedSoundUrl(key, expires = 60) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    }),
    { expiresIn: expires }
  );
}

module.exports = { getSignedSoundUrl };
