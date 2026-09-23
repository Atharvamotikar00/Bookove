const fs = require('node:fs');

/**
 * File persistence layer for uploaded books and avatars.
 *
 *  - Blob mode: when BLOB_READ_WRITE_TOKEN is set (Vercel Blob store linked
 *    to the project), files live in Vercel Blob — persistent across deploys
 *    and shared across function instances.
 *  - Local mode: files live in the on-disk uploads/ directory (local dev).
 */

let blob = null;
if (process.env.BLOB_READ_WRITE_TOKEN) {
  blob = require('@vercel/blob');
}

const blobEnabled = !!blob;
const BOOKS_PREFIX = 'books/';
const AVATARS_PREFIX = 'avatars/';

/** Upload a staged local file to blob storage. Returns its public URL. */
async function saveFile(key, localPath, contentType) {
  if (!blob) return null;
  const result = await blob.put(key, fs.createReadStream(localPath), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    ...(contentType ? { contentType } : {}),
  });
  return result.url;
}

/** Look up the public URL for a stored key. Returns null if missing. */
async function getFileUrl(key) {
  if (!blob) return null;
  try {
    const meta = await blob.head(key);
    return meta.url;
  } catch (_) {
    return null;
  }
}

/** Delete a stored key. Returns true when blob storage handled it. */
async function deleteFile(key) {
  if (!blob) return false;
  try {
    await blob.del(key);
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = { blobEnabled, saveFile, getFileUrl, deleteFile, BOOKS_PREFIX, AVATARS_PREFIX };
