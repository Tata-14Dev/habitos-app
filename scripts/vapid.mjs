// Generates the VAPID key pair for Web Push. Public key → .env.local; private key → Supabase secret.
import webpush from 'web-push'
const { publicKey, privateKey } = webpush.generateVAPIDKeys()
console.log(`\nVITE_VAPID_PUBLIC_KEY=${publicKey}   ← en .env.local (y en Vercel)\n`)
console.log('Y en Supabase (no la subas a git):')
console.log(`npx supabase secrets set VAPID_PUBLIC_KEY=${publicKey} VAPID_PRIVATE_KEY=${privateKey}\n`)
