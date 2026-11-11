// Generates the VAPID key pair for the Spese push server. Run once:  node push-worker/scripts/generate-vapid.mjs
// - PUBLIC key  → wrangler.toml VAPID_PUBLIC_KEY  (and it's fine to share)
// - PRIVATE JWK → `npx wrangler secret put VAPID_PRIVATE_JWK` (keep it secret; don't commit it)
import { webcrypto as crypto } from 'node:crypto'

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const raw = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64url')
const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)

console.log('\nVAPID_PUBLIC_KEY (put in wrangler.toml):\n')
console.log(raw)
console.log('\nVAPID_PRIVATE_JWK (paste when `npx wrangler secret put VAPID_PRIVATE_JWK` asks — keep it secret):\n')
console.log(JSON.stringify({ kty: jwk.kty, crv: jwk.crv, d: jwk.d, x: jwk.x, y: jwk.y }))
console.log()
