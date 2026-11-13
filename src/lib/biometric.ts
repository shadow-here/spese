import { fromBase64Url, toBase64Url } from './pin'
import { allowSystemUi } from './systemUi'

/**
 * Face ID / fingerprint unlock via WebAuthn with the device's own (platform) authenticator.
 * Used purely as a local "is this the phone's owner?" check for the app lock — there's no server,
 * so nothing is sent anywhere and Spese never sees biometric data, only an opaque credential id.
 */

export async function biometricAvailable(): Promise<boolean> {
  try {
    return (
      typeof PublicKeyCredential !== 'undefined' &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    )
  } catch {
    return false
  }
}

/** Creates a device credential (prompts Face ID / fingerprint). Returns its id, or throws if cancelled. */
export async function registerBiometric(): Promise<string> {
  allowSystemUi()
  const credential = (await navigator.credentials.create({
    publicKey: {
      rp: { name: 'Spese' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'spese', displayName: 'Spese' },
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60_000,
      attestation: 'none',
    },
  })) as PublicKeyCredential | null
  if (!credential) throw new Error('Face ID / fingerprint setup was cancelled')
  return toBase64Url(credential.rawId)
}

/** Asks for Face ID / fingerprint against the saved credential. Resolves true only on success. */
export async function verifyBiometric(credentialId: string): Promise<boolean> {
  allowSystemUi()
  try {
    const result = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: fromBase64Url(credentialId), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })
    return result !== null
  } catch {
    return false
  }
}
