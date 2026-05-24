/**
 * Centralised E2E key bootstrap.
 * Call once after sign-in (and on every cold start) to:
 *   1. Ensure a Curve25519 keypair exists in the device's secure store.
 *   2. Push the public half to the user's profile so the partner can encrypt
 *      messages to us.
 *   3. Cache the partner's public key (if paired) for fast access in chat.
 *
 * Secret keys never leave the device.
 */
import { supabase } from '@/services/supabase';
import {
  getMyPublicKeyB64,
  setPartnerPublicKey,
  getPartnerPublicKey,
} from '@/services/secureKeys';

export async function syncMyPublicKey(userId: string): Promise<string> {
  const pub = await getMyPublicKeyB64();
  // Only update if changed — avoids unnecessary writes during hot reload loops.
  const { data } = await supabase
    .from('profiles')
    .select('public_key')
    .eq('id', userId)
    .maybeSingle();

  if (data?.public_key !== pub) {
    await supabase.from('profiles').update({ public_key: pub }).eq('id', userId);
  }
  return pub;
}

export async function syncPartnerPublicKey(): Promise<string | null> {
  const { data, error } = await supabase.rpc('partner_public_key');
  if (error) return getPartnerPublicKey();
  const key = (data as string | null) ?? null;
  if (key) await setPartnerPublicKey(key);
  return key;
}

/** Convenience for callers that want both halves at once. */
export async function bootstrapKeys(userId: string): Promise<{
  myPublicKey: string;
  partnerPublicKey: string | null;
}> {
  const [myPublicKey, partnerPublicKey] = await Promise.all([
    syncMyPublicKey(userId),
    syncPartnerPublicKey(),
  ]);
  return { myPublicKey, partnerPublicKey };
}
