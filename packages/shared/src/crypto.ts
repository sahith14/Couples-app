/**
 * SoulSync end-to-end encryption.
 *
 * Design:
 *  - Each user generates a Curve25519 keypair on first launch.
 *  - Public key is uploaded to the profile; secret key never leaves the device
 *    (stored in expo-secure-store / Keychain / Keystore).
 *  - Messages and secret-vault items are encrypted with tweetnacl.box (XSalsa20+Poly1305+X25519).
 *  - For symmetric secret vault (large media) we wrap a random secretbox key per memory using
 *    the recipient's public key, so both partners can decrypt without sharing master keys.
 *
 * IMPORTANT: This package only contains primitives. Key storage lives in the mobile app's
 * `services/secureKeys.ts` to keep platform deps out of shared.
 */

import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface KeyPairB64 {
  publicKey: string;
  secretKey: string;
}

export const toB64 = (b: Uint8Array): string => naclUtil.encodeBase64(b);
export const fromB64 = (s: string): Uint8Array => naclUtil.decodeBase64(s);
export const toUtf8 = (b: Uint8Array): string => naclUtil.encodeUTF8(b);
export const fromUtf8 = (s: string): Uint8Array => naclUtil.decodeUTF8(s);

export function generateKeyPair(): KeyPair {
  return nacl.box.keyPair();
}

export function exportKeyPair(kp: KeyPair): KeyPairB64 {
  return { publicKey: toB64(kp.publicKey), secretKey: toB64(kp.secretKey) };
}

export function importKeyPair(kp: KeyPairB64): KeyPair {
  return { publicKey: fromB64(kp.publicKey), secretKey: fromB64(kp.secretKey) };
}

export interface SealedPayload {
  ciphertext: string; // base64
  nonce: string;      // base64
}

/** Encrypt UTF-8 text from `me` to `theirPublicKey`. */
export function sealText(
  text: string,
  theirPublicKey: Uint8Array,
  mySecretKey: Uint8Array,
): SealedPayload {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const message = fromUtf8(text);
  const ct = nacl.box(message, nonce, theirPublicKey, mySecretKey);
  return { ciphertext: toB64(ct), nonce: toB64(nonce) };
}

/** Decrypt a payload sent from `theirPublicKey` to me. Returns null on failure. */
export function openText(
  payload: SealedPayload,
  theirPublicKey: Uint8Array,
  mySecretKey: Uint8Array,
): string | null {
  const ct = fromB64(payload.ciphertext);
  const nonce = fromB64(payload.nonce);
  const opened = nacl.box.open(ct, nonce, theirPublicKey, mySecretKey);
  return opened ? toUtf8(opened) : null;
}

/** Symmetric encryption for media blobs using a one-time random key. */
export function generateMediaKey(): Uint8Array {
  return nacl.randomBytes(nacl.secretbox.keyLength);
}

export function encryptBytes(
  data: Uint8Array,
  key: Uint8Array,
): { ciphertext: Uint8Array; nonce: Uint8Array } {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const ct = nacl.secretbox(data, nonce, key);
  return { ciphertext: ct, nonce };
}

export function decryptBytes(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array,
): Uint8Array | null {
  return nacl.secretbox.open(ciphertext, nonce, key);
}

/** Wrap a random media key for the partner using their public key. */
export function wrapKeyForPartner(
  mediaKey: Uint8Array,
  partnerPublicKey: Uint8Array,
  mySecretKey: Uint8Array,
): SealedPayload {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const ct = nacl.box(mediaKey, nonce, partnerPublicKey, mySecretKey);
  return { ciphertext: toB64(ct), nonce: toB64(nonce) };
}

export function unwrapMediaKey(
  payload: SealedPayload,
  partnerPublicKey: Uint8Array,
  mySecretKey: Uint8Array,
): Uint8Array | null {
  return nacl.box.open(
    fromB64(payload.ciphertext),
    fromB64(payload.nonce),
    partnerPublicKey,
    mySecretKey,
  );
}

/** Lightweight pin/passphrase derivation for local-only locks (not for E2E).
 *  Uses scrypt-style iteration via repeated hashing — for stronger needs, switch to argon2id
 *  via expo-crypto in the mobile app. */
export function pinHash(pin: string, saltB64?: string): { hash: string; salt: string } {
  const salt = saltB64 ? fromB64(saltB64) : nacl.randomBytes(16);
  let buf = fromUtf8(pin + ':' + toB64(salt));
  for (let i = 0; i < 50_000; i++) buf = nacl.hash(buf);
  return { hash: toB64(buf), salt: toB64(salt) };
}

export function verifyPin(pin: string, saltB64: string, expectedHashB64: string): boolean {
  const { hash } = pinHash(pin, saltB64);
  // constant-time compare
  const a = fromB64(hash);
  const b = fromB64(expectedHashB64);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}
