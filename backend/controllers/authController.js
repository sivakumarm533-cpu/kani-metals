import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { verify as verifyTotp } from 'otplib'
import User from '../models/User.js'
import TotpChallenge from '../models/TotpChallenge.js'
import AuthSession from '../models/AuthSession.js'
import { getJwtSecret } from '../config/secrets.js'
import { decryptTotpSecret, encryptTotpSecret, hashChallenge, makeTotpQr, newChallenge, newRecoveryCodes, newTotpSecret } from '../utils/totp.js'

const allowedAdminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase()
const previousAdminEmail = 'sivakumar.m533@gmail.com'
const challengeLifetimeMs = 5 * 60 * 1000
const sessionLifetimeMs = 12 * 60 * 60 * 1000
const retiredDemoAdminEmails = new Set(['demo.admin@example.test', 'demo.admin@localhost.test'])
const emailIsAllowed = (email) => String(email || '').trim().toLowerCase() === allowedAdminEmail
const canMigrateAdminEmail = (email) => emailIsAllowed(email) || String(email || '').trim().toLowerCase() === previousAdminEmail
const primaryAdminExists = () => User.exists({ role: 'admin', email: { $in: [allowedAdminEmail, previousAdminEmail].filter(Boolean) } })
const isRetiredDemoAdmin = (email) => retiredDemoAdminEmails.has(String(email || '').trim().toLowerCase())
const publicUser = (user) => ({ _id: user._id, id: user._id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt })

async function adminSetupIsComplete() {
  if (await primaryAdminExists()) return true
  const administrators = await User.find({ role: 'admin' }).select('email').lean()
  return administrators.length > 0 && !(administrators.length === 1 && isRetiredDemoAdmin(administrators[0]?.email))
}

async function findClaimableDemoAdmin() {
  const administrators = await User.find({ role: 'admin' }).select('email')
  if (administrators.length === 1 && isRetiredDemoAdmin(administrators[0].email)) return administrators[0]
  return null
}

async function createSession(user) {
  const jti = randomUUID()
  const expiresAt = new Date(Date.now() + sessionLifetimeMs)
  await AuthSession.create({ jti, user: user._id, expiresAt })
  const token = jwt.sign({ sub: user._id.toString(), role: user.role, jti }, getJwtSecret(), { expiresIn: '12h' })
  return { token, user: publicUser(user) }
}

function setupKeyMatches(candidate) {
  const expected = String(process.env.ADMIN_SETUP_KEY || '')
  const supplied = String(candidate || '')
  if (!expected || !supplied) return false
  const expectedBuffer = Buffer.from(expected)
  const suppliedBuffer = Buffer.from(supplied)
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer)
}

async function createTotpChallenge({ purpose, email, user, name, passwordHash }) {
  const challenge = newChallenge()
  const secretEncrypted = encryptTotpSecret(newTotpSecret())
  const secret = decryptTotpSecret(secretEncrypted)
  await TotpChallenge.create({
    challengeHash: hashChallenge(challenge), purpose, email,
    ...(user ? { user: user._id } : {}), ...(name ? { name } : {}), ...(passwordHash ? { passwordHash } : {}),
    secretEncrypted, attempts: 0, expiresAt: new Date(Date.now() + challengeLifetimeMs),
  })
  try {
    return { challenge, qrCodeDataUrl: await makeTotpQr(email, secret), expiresIn: 300 }
  } catch (error) {
    await TotpChallenge.deleteOne({ challengeHash: hashChallenge(challenge) })
    throw error
  }
}

async function getChallenge(token, purpose) {
  if (typeof token !== 'string' || token.length < 32 || token.length > 256) return null
  return TotpChallenge.findOneAndUpdate({
    challengeHash: hashChallenge(token), purpose, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 },
  }, { $inc: { attempts: 1 } }, { returnDocument: 'after' }).select('+secretEncrypted').select('+passwordHash')
}

async function verifyTotpCode(secret, code, afterTimeStep = -1) {
  const token = String(code || '').trim()
  if (!/^\d{6}$/.test(token)) return null
  const options = { secret, token, epochTolerance: [30, 0] }
  if (afterTimeStep >= 0) options.afterTimeStep = afterTimeStep
  const result = await verifyTotp(options)
  return result.valid ? result : null
}

function invalidChallenge(res) {
  return res.status(400).json({ message: 'The authenticator code is invalid, expired, or this challenge has reached its attempt limit.' })
}

async function storeRecoveryCodes(user) {
  const recoveryCodes = newRecoveryCodes()
  user.recoveryCodeHashes = await Promise.all(recoveryCodes.map((code) => bcrypt.hash(code, 10)))
  return recoveryCodes
}

export async function authStatus(_req, res, next) {
  try {
    res.json({ adminExists: await adminSetupIsComplete(), signupEmail: allowedAdminEmail })
  } catch (error) { next(error) }
}

export async function beginAdminEnrollment(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    if (!allowedAdminEmail) return res.status(503).json({ message: 'Admin email is not configured on the backend.' })
    if (!emailIsAllowed(email)) return res.status(403).json({ message: 'Admin setup is restricted to the authorized email address.' })
    if (await adminSetupIsComplete()) return res.status(409).json({ message: 'Initial admin registration is disabled. Sign in instead.' })
    if (!process.env.ADMIN_SETUP_KEY) return res.status(503).json({ message: 'One-time admin setup is not configured on the backend.' })
    if (!setupKeyMatches(req.body.setupKey)) return res.status(403).json({ message: 'The one-time admin setup key is invalid.' })
    const { name, password, confirmPassword } = req.body
    if (typeof name !== 'string' || !name.trim() || typeof password !== 'string' || password.length < 12) return res.status(400).json({ message: 'Enter your name and a password with at least 12 characters.' })
    if (password !== confirmPassword) return res.status(400).json({ message: 'Password and confirmation do not match.' })
    const passwordHash = await bcrypt.hash(password, 12)
    const enrollment = await createTotpChallenge({ purpose: 'registration', email, name: name.trim(), passwordHash })
    res.json({ ...enrollment, message: 'Scan the QR code with Google Authenticator, then enter the current 6-digit code.' })
  } catch (error) { next(error) }
}

export async function verifyAdminEnrollment(req, res, next) {
  try {
    const purpose = req.body.purpose === 'enrollment' ? 'enrollment' : 'registration'
    const challenge = await getChallenge(req.body.challenge, purpose)
    if (!challenge || !emailIsAllowed(challenge.email)) return invalidChallenge(res)
    const secret = decryptTotpSecret(challenge.secretEncrypted)
    const verified = await verifyTotpCode(secret, req.body.code)
    if (!verified) return invalidChallenge(res)

    const claimed = await TotpChallenge.findOneAndDelete({ _id: challenge._id, attempts: { $lte: 5 }, expiresAt: { $gt: new Date() } }).select('+passwordHash').select('+secretEncrypted')
    if (!claimed) return invalidChallenge(res)

    let user
    if (purpose === 'registration') {
      if (await adminSetupIsComplete()) return res.status(409).json({ message: 'Initial admin registration has already been completed.' })
      const demoAdmin = await findClaimableDemoAdmin()
      if (demoAdmin) {
        user = await User.findById(demoAdmin._id)
        user.name = claimed.name
        user.email = allowedAdminEmail
        user.passwordHash = claimed.passwordHash
        user.totpSecretEncrypted = claimed.secretEncrypted
        user.totpEnabled = true
        user.totpLastTimeStep = verified.timeStep
      } else {
        user = await User.create({
          name: claimed.name,
          email: allowedAdminEmail,
          passwordHash: claimed.passwordHash,
          role: 'admin',
          totpSecretEncrypted: claimed.secretEncrypted,
          totpEnabled: true,
          totpLastTimeStep: verified.timeStep,
        })
      }
    } else {
      user = await User.findById(claimed.user).select('+totpSecretEncrypted').select('+recoveryCodeHashes')
      if (!user || user.role !== 'admin' || user.totpEnabled || !canMigrateAdminEmail(user.email)) return res.status(409).json({ message: 'This admin enrollment is no longer available. Sign in again.' })
      user.totpSecretEncrypted = claimed.secretEncrypted
      user.totpEnabled = true
      user.totpLastTimeStep = verified.timeStep
      const emailConflict = await User.exists({ email: allowedAdminEmail, _id: { $ne: user._id } })
      if (emailConflict) return res.status(409).json({ message: 'The authorized admin email is already assigned to another account. Remove or rename that account first.' })
      user.email = allowedAdminEmail
    }
    const recoveryCodes = await storeRecoveryCodes(user)
    await user.save()
    await AuthSession.deleteMany({ user: user._id })
    res.json({ ...await createSession(user), recoveryCodes, message: 'Authenticator enabled. Save these recovery codes now; they are shown only once.' })
  } catch (error) { next(error) }
}

export async function login(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    const password = String(req.body.password || '')
    const user = await User.findOne({ email }).select('+passwordHash').select('+totpSecretEncrypted')
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Email or password is incorrect.' })
    if (user.role !== 'admin') return res.json({ requiresTotp: false, ...await createSession(user) })
    if (!allowedAdminEmail) return res.status(503).json({ message: 'Admin email is not configured on the backend.' })
    if (!canMigrateAdminEmail(user.email)) return res.status(403).json({ message: 'Admin account is not authorized.' })
    if (!user.totpEnabled || !user.totpSecretEncrypted) {
      const enrollment = await createTotpChallenge({ purpose: 'enrollment', email: allowedAdminEmail, user })
      return res.json({ requiresTotpEnrollment: true, enrollmentChallenge: enrollment.challenge, qrCodeDataUrl: enrollment.qrCodeDataUrl, expiresIn: enrollment.expiresIn, message: 'Scan this QR code with Google Authenticator to secure your account.' })
    }
    const challenge = newChallenge()
    await TotpChallenge.create({ challengeHash: hashChallenge(challenge), purpose: 'login', email: allowedAdminEmail, user: user._id, attempts: 0, expiresAt: new Date(Date.now() + challengeLifetimeMs) })
    res.json({ requiresTotp: true, loginChallenge: challenge, email: allowedAdminEmail, message: 'Password verified. Enter the current code from Google Authenticator.' })
  } catch (error) { next(error) }
}

export async function verifyLoginTotp(req, res, next) {
  try {
    const challenge = await getChallenge(req.body.loginChallenge, 'login')
    if (!challenge) return invalidChallenge(res)
    const user = await User.findById(challenge.user).select('+totpSecretEncrypted').select('+totpLastTimeStep')
    if (!user || user.role !== 'admin' || !user.totpEnabled || !user.totpSecretEncrypted || !canMigrateAdminEmail(user.email)) return res.status(401).json({ message: 'This admin login is unavailable. Sign in again.' })
    const secret = decryptTotpSecret(user.totpSecretEncrypted)
    const verified = await verifyTotpCode(secret, req.body.code, user.totpLastTimeStep ?? -1)
    if (!verified) return invalidChallenge(res)
    const lastStepFilter = user.totpLastTimeStep === undefined ? { $exists: false } : user.totpLastTimeStep
    const updated = await User.updateOne({ _id: user._id, totpLastTimeStep: lastStepFilter }, { $set: { totpLastTimeStep: verified.timeStep } })
    if (!updated.modifiedCount) return res.status(400).json({ message: 'That authenticator code has already been used. Wait for the next code and try again.' })
    const consumed = await TotpChallenge.findOneAndDelete({ _id: challenge._id })
    if (!consumed) return invalidChallenge(res)
    const emailConflict = await User.exists({ email: allowedAdminEmail, _id: { $ne: user._id } })
    if (emailConflict) return res.status(409).json({ message: 'The authorized admin email is already assigned to another account. Remove or rename that account first.' })
    if (user.email !== allowedAdminEmail) { user.email = allowedAdminEmail; await user.save() }
    res.json(await createSession(user))
  } catch (error) { next(error) }
}

export async function verifyLoginRecovery(req, res, next) {
  try {
    const challenge = await getChallenge(req.body.loginChallenge, 'login')
    if (!challenge) return invalidChallenge(res)
    const user = await User.findById(challenge.user).select('+recoveryCodeHashes')
    if (!user || user.role !== 'admin' || !user.totpEnabled) return res.status(401).json({ message: 'This recovery challenge is unavailable. Sign in again.' })
    if (!canMigrateAdminEmail(user.email)) return res.status(401).json({ message: 'This admin recovery challenge is unavailable. Sign in again.' })
    const emailConflict = await User.exists({ email: allowedAdminEmail, _id: { $ne: user._id } })
    if (emailConflict) return res.status(409).json({ message: 'The authorized admin email is already assigned to another account. Remove or rename that account first.' })
    const submitted = String(req.body.recoveryCode || '').trim().toUpperCase()
    if (!/^[A-F0-9]{4}(?:-[A-F0-9]{4}){3}$/.test(submitted)) return invalidChallenge(res)
    let matchedHash = null
    for (const hash of user.recoveryCodeHashes || []) {
      if (await bcrypt.compare(submitted, hash)) matchedHash = hash
    }
    if (!matchedHash) return invalidChallenge(res)
    const removed = await User.updateOne({ _id: user._id, recoveryCodeHashes: matchedHash }, { $pull: { recoveryCodeHashes: matchedHash } })
    if (!removed.modifiedCount) return res.status(400).json({ message: 'That recovery code has already been used or is invalid.' })
    const consumed = await TotpChallenge.findOneAndDelete({ _id: challenge._id })
    if (!consumed) return invalidChallenge(res)
    if (user.email !== allowedAdminEmail) await User.updateOne({ _id: user._id }, { $set: { email: allowedAdminEmail } })
    const fullUser = await User.findById(user._id)
    res.json({ ...await createSession(fullUser), message: 'Signed in using a recovery code.' })
  } catch (error) { next(error) }
}

export async function logout(req, res, next) {
  try { await AuthSession.deleteOne({ jti: req.authSessionId }); res.json({ message: 'Signed out.' }) }
  catch (error) { next(error) }
}

export function currentUser(req, res) { res.json({ user: publicUser(req.user) }) }

export async function listUsers(_req, res, next) {
  try { res.json(await User.find().select('name email role createdAt').sort({ createdAt: -1 })) }
  catch (error) { next(error) }
}

export async function createUser(req, res, next) {
  try {
    const { name, email, password } = req.body
    if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email) || typeof password !== 'string' || password.length < 12) {
      return res.status(400).json({ message: 'Provide a name, valid email, and password with at least 12 characters.' })
    }
    const normalizedEmail = email.trim().toLowerCase()
    if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ message: 'An account with this email already exists.' })
    const user = await User.create({ name: name.trim(), email: normalizedEmail, passwordHash: await bcrypt.hash(password, 12), role: 'user' })
    res.status(201).json(publicUser(user))
  } catch (error) { next(error) }
}

export async function deleteUser(req, res, next) {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ message: 'You cannot delete your own account.' })
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ message: 'User not found.' })
    if (user.role === 'admin') return res.status(403).json({ message: 'The primary admin account cannot be deleted here.' })
    await AuthSession.deleteMany({ user: user._id })
    await user.deleteOne()
    res.json({ message: 'User deleted.' })
  } catch (error) { next(error) }
}
