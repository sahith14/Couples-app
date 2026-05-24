import * as SecureStore from 'expo-secure-store';
import {
  exportKeyPair,
  generateKeyPair,
  importKeyPair,
  type KeyPair,
  type KeyPairB64,
} from '@soulsync/shared';

const KEY_PAIR_KEY = 'soulsync.e2e.keypair.v1';
const PARTNER_PUBKEY_KEY = 'soulsync.e2e.partner.pubkey.v1';

export async function loadOrCreateKeyPair(): Promise<KeyPair> {
  const raw = await SecureStore.getItemAsync(KEY_PAIR_KEY);
  if (raw) {
    const parsed = JSON.parse(raw) as KeyPairB64;
    return importKeyPair(parsed);
  }
  const kp = generateKeyPair();
  await SecureStore.setItemAsync(KEY_PAIR_KEY, JSON.stringify(exportKeyPair(kp)), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return kp;
}

export async function getMyPublicKeyB64(): Promise<string> {
  const kp = await loadOrCreateKeyPair();
  return exportKeyPair(kp).publicKey;
}

export async function setPartnerPublicKey(publicKeyB64: string): Promise<void> {
  await SecureStore.setItemAsync(PARTNER_PUBKEY_KEY, publicKeyB64);
}

export async function getPartnerPublicKey(): Promise<string | null> {
  return SecureStore.getItemAsync(PARTNER_PUBKEY_KEY);
}

export async function clearAllSecrets(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_PAIR_KEY);
  await SecureStore.deleteItemAsync(PARTNER_PUBKEY_KEY);
}
