import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'

const testDatabase = `kani_admin_setup_${randomUUID().replaceAll('-', '')}`
process.env.MONGODB_URI = `mongodb://127.0.0.1:27017/${testDatabase}`
process.env.JWT_SECRET = randomBytes(40).toString('hex')
process.env.ADMIN_EMAIL = 'kanimetal1972@gmail.com'
process.env.ADMIN_SETUP_KEY = randomBytes(32).toString('base64url')
process.env.TOTP_ENCRYPTION_KEY = randomBytes(32).toString('base64')
process.env.VERCEL = '1'

const [{ default: app }, { default: mongoose }, { default: connectDB }, { default: User }, { default: TotpChallenge }, { default: AuthSession }, { generate }, helpers] = await Promise.all([
  import('../server.js'), import('mongoose'), import('../config/db.js'), import('../models/User.js'), import('../models/TotpChallenge.js'), import('../models/AuthSession.js'), import('otplib'), import('../utils/totp.js'),
])
const { decryptTotpSecret, hashChallenge } = helpers
await connectDB()
const server = app.listen(0)
await new Promise((resolve) => server.once('listening', resolve))
const api = `http://127.0.0.1:${server.address().port}/api`

async function post(path, body, token) {
  const response = await fetch(`${api}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  return { status: response.status, body: await response.json() }
}

try {
  const demo = await User.create({ name: 'Demo Admin', email: 'demo.admin@example.test', passwordHash: await bcrypt.hash('unused-demo-password', 12), role: 'admin' })
  const staleSessionId = 'retired-demo-admin-session'
  await AuthSession.create({ jti: staleSessionId, user: demo._id, expiresAt: new Date(Date.now() + 60_000) })
  const staleToken = (await import('jsonwebtoken')).default.sign({ sub: demo._id.toString(), role: 'admin', jti: staleSessionId }, process.env.JWT_SECRET, { expiresIn: '1h' })

  const status = await fetch(`${api}/auth/status`).then((response) => response.json())
  assert.equal(status.adminExists, false, 'a single retired demo account must not block owner setup')
  assert.equal((await fetch(`${api}/auth/me`, { headers: { Authorization: `Bearer ${staleToken}` } })).status, 403)

  const setup = await post('/auth/totp/enroll', {
    email: process.env.ADMIN_EMAIL,
    name: 'Kani Metals Owner',
    password: 'owner-test-password-123',
    confirmPassword: 'owner-test-password-123',
    setupKey: process.env.ADMIN_SETUP_KEY,
  })
  assert.equal(setup.status, 200)
  assert.match(setup.body.qrCodeDataUrl, /^data:image\/png;base64,/)
  assert.equal('secret' in setup.body, false)

  const pending = await TotpChallenge.findOne({ challengeHash: hashChallenge(setup.body.challenge) }).select('+secretEncrypted').select('+passwordHash')
  const code = await generate({ secret: decryptTotpSecret(pending.secretEncrypted) })
  const completed = await post('/auth/totp/enroll/verify', { challenge: setup.body.challenge, code })
  assert.equal(completed.status, 200)
  assert.equal(completed.body.user.email, process.env.ADMIN_EMAIL)
  assert.equal(completed.body.user.name, 'Kani Metals Owner')
  assert.equal(completed.body.recoveryCodes.length, 10)

  const admins = await User.find({ role: 'admin' }).select('email name totpEnabled')
  assert.equal(admins.length, 1, 'claiming the demo record must not create a second admin')
  assert.equal(admins[0]._id.toString(), demo._id.toString(), 'the old demo user record should be reused')
  assert.equal(admins[0].totpEnabled, true)
  assert.equal(await AuthSession.exists({ jti: staleSessionId }), null, 'retired demo sessions must be revoked')
  assert.equal((await fetch(`${api}/auth/status`).then((response) => response.json())).adminExists, true)
  assert.equal((await post('/auth/totp/enroll', { email: process.env.ADMIN_EMAIL, setupKey: process.env.ADMIN_SETUP_KEY })).status, 409)
  console.log('Admin setup integration checks passed: retired demo admin claimed in place, single owner enforced, QR/TOTP verified, old demo session revoked.')
} finally {
  await new Promise((resolve) => server.close(resolve))
  if (mongoose.connection.readyState) {
    await mongoose.connection.dropDatabase()
    await mongoose.disconnect()
  }
}
