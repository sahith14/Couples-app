/**
 * Chat-only encryption helpers that build on the shared crypto primitives.
 *
 * For text: nacl.box(senderSk, partnerPk) → ciphertext goes straight into
 *   messages.ciphertext (already wired in chat.tsx).
 *
 * For media (image/voice/video):
 *   1. Generate a random secretbox key.
 *   2. Encrypt the file bytes with secretbox.
 *   3. Upload the ciphertext to `chat/{couple_id}/...` storage.
 *   4. Wrap the secretbox key with nacl.box for the partner and store
 *      the wrapped key + nonce on the message row (ciphertext + nonce
 *      bytea columns are reused for this).
 *
 * This way the server/storage never sees plaintext media or the media key.
 */
import {
  generateMediaKey,
  encryptBytes,
  decryptBytes,
  wrapKeyForPartner,
  unwrapMediaKey,
  fromB64,
  toB64,
  type SealedPayload,
} from '@soulsync/shared';

export interface SealedMedia {
  /** Encrypted file bytes ready to upload. */
  ciphertext: Uint8Array;
  /** Wrapped (per-partner) media key + nonce — store on the message row. */
  wrappedKey: SealedPayload;
  /** secretbox nonce for the file body (combined with wrappedKey on read). */
  fileNonce: string;
}

/**
 * Encrypt a file (already loaded as bytes) for the partner.
 * Returns the ciphertext blob to upload + the metadata to put on the message.
 */
export function sealMedia(
  bytes: Uint8Array,
  partnerPublicKey: Uint8Array,
  mySecretKey: Uint8Array,
): SealedMedia {
  const key = generateMediaKey();
  const { ciphertext, nonce } = encryptBytes(bytes, key);
  const wrappedKey = wrapKeyForPartner(key, partnerPublicKey, mySecretKey);
  return { ciphertext, wrappedKey, fileNonce: toB64(nonce) };
}

/** Open ciphertext bytes given the wrapped key + file nonce we received. */
export function openMedia(
  ciphertext: Uint8Array,
  wrappedKey: SealedPayload,
  fileNonceB64: string,
  partnerPublicKey: Uint8Array,
  mySecretKey: Uint8Array,
): Uint8Array | null {
  const key = unwrapMediaKey(wrappedKey, partnerPublicKey, mySecretKey);
  if (!key) return null;
  return decryptBytes(ciphertext, fromB64(fileNonceB64), key);
}
