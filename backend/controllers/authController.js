import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'
import { randomInt, randomUUID } from 'node:crypto'
import User from '../models/User.js'
import EmailVerification from '../models/EmailVerification.js'
import AuthSession from '../models/AuthSession.js'
import { getJwtSecret } from '../config/secrets.js'

const allowedAdminEmail = 'sivakumar.m533@gmail.com'
const otpLifetimeMs = 5 * 60 * 1000
const sessionLifetimeMs = 12 * 60 * 60 * 1000
const emailIsAllowed = (email) => String(email || '').trim().toLowerCase() === allowedAdminEmail
function demoLoginIsEnabled(req) {
  const clientIp = req.ip || req.socket.remoteAddress
  const isLocal = ['::1', '127.0.0.1', '::ffff:127.0.0.1'].includes(clientIp)
  return process.env.ENABLE_DEMO_ADMIN === 'true' && process.env.NODE_ENV !== 'production' && !process.env.VERCEL && isLocal && Boolean(process.env.DEMO_ADMIN_EMAIL && process.env.DEMO_ADMIN_PASSWORD && process.env.DEMO_ADMIN_PASSWORD.length >= 12)
}
const publicUser = (user) => ({ _id: user._id, id: user._id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt })

async function createSession(user) {
  const jti = randomUUID()
  const expiresAt = new Date(Date.now() + sessionLifetimeMs)
  await AuthSession.create({ jti, user: user._id, expiresAt })
  const token = jwt.sign({ sub: user._id.toString(), role: user.role, jti }, getJwtSecret(), { expiresIn: '12h' })
  return { token, user: publicUser(user) }
}

async function sendOtp(email, purpose, subject, intro) {
  if (!process.env.SMTP_USER || !process.env.SMTP_APP_PASSWORD) {
    const error = new Error('Email verification is not configured. Set SMTP_USER and SMTP_APP_PASSWORD on the backend.')
    error.statusCode = 503
    throw error
  }
  const previous = await EmailVerification.findOne({ email, purpose })
  if (previous && Date.now() - previous.lastSentAt.getTime() < 60_000) {
    const error = new Error('Wait 60 seconds before requesting another code.')
    error.statusCode = 429
    throw error
  }
  const otp = String(randomInt(100000, 1000000))
  await EmailVerification.findOneAndUpdate({ email, purpose }, {
    $set: { codeHash: await bcrypt.hash(otp, 10), attempts: 0, lastSentAt: new Date(), expiresAt: new Date(Date.now() + otpLifetimeMs) },
    $setOnInsert: { email, purpose },
  }, { upsert: true, new: true, setDefaultsOnInsert: true })
  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_APP_PASSWORD } })
  await transporter.sendMail({ from: `Kani Metals <${process.env.SMTP_USER}>`, to: email, subject, text: `${intro}\n\nYour 6-digit code is ${otp}. It expires in 5 minutes. If you did not request this, ignore this email.` })
}

async function validateOtp(email, purpose, otp) {
  const verification = await EmailVerification.findOne({ email, purpose })
  if (!verification || verification.expiresAt <= new Date() || verification.attempts >= 5) return false
  if (!(await bcrypt.compare(String(otp || '').trim(), verification.codeHash))) {
    verification.attempts += 1
    await verification.save()
    return false
  }
  const removed = await EmailVerification.deleteOne({ _id: verification._id, codeHash: verification.codeHash })
  return removed.deletedCount === 1
}

export async function authStatus(req, res, next) {
  try {
    const demoLoginEnabled = demoLoginIsEnabled(req)
    res.json({ adminExists: Boolean(await User.exists({ role: 'admin' })), signupEmail: allowedAdminEmail, demoLoginEnabled, demoCredentials: demoLoginEnabled ? { email: process.env.DEMO_ADMIN_EMAIL, password: process.env.DEMO_ADMIN_PASSWORD } : undefined })
  }
  catch (error) { next(error) }
}

export async function sendRegistrationOtp(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    if (!emailIsAllowed(email)) return res.status(403).json({ message: 'Admin signup is restricted to the authorized Gmail account.' })
    if (await User.exists({ role: 'admin' })) return res.status(409).json({ message: 'Initial admin registration is disabled. Sign in instead.' })
    await sendOtp(email, 'registration', 'Kani Metals admin registration code', 'Use this code to verify the authorized admin email.')
    res.json({ message: `A verification code was sent to ${allowedAdminEmail}.` })
  } catch (error) { next(error) }
}

export async function verifyRegistrationOtp(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    if (!emailIsAllowed(email)) return res.status(403).json({ message: 'This email is not authorized for admin signup.' })
    if (!(await validateOtp(email, 'registration', req.body.otp))) return res.status(400).json({ message: 'The OTP is invalid, expired, or has reached its attempt limit.' })
    const signupToken = jwt.sign({ email, purpose: 'create-admin' }, getJwtSecret(), { expiresIn: '5m' })
    res.json({ signupToken })
  } catch (error) { next(error) }
}

export async function createAdmin(req, res, next) {
  try {
    const { signupToken, name, password, confirmPassword } = req.body
    const verified = jwt.verify(signupToken, getJwtSecret())
    if (verified.purpose !== 'create-admin' || !emailIsAllowed(verified.email)) return res.status(403).json({ message: 'Admin email verification is required.' })
    if (typeof name !== 'string' || !name.trim() || typeof password !== 'string' || password.length < 12) return res.status(400).json({ message: 'Enter your name and a password with at least 12 characters.' })
    if (password !== confirmPassword) return res.status(400).json({ message: 'Password and confirmation do not match.' })
    if (await User.exists({ role: 'admin' })) return res.status(409).json({ message: 'Initial admin registration is disabled.' })
    const user = await User.create({ name: name.trim(), email: allowedAdminEmail, passwordHash: await bcrypt.hash(password, 12), role: 'admin' })
    await EmailVerification.deleteMany({ email: allowedAdminEmail })
    res.status(201).json(await createSession(user))
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') return res.status(401).json({ message: 'Email verification has expired. Request a new OTP.' })
    next(error)
  }
}

export async function login(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    const password = String(req.body.password || '')
    const user = await User.findOne({ email }).select('+passwordHash')
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Email or password is incorrect.' })
    if (user.role === 'admin') {
      if (!emailIsAllowed(user.email)) return res.status(403).json({ message: 'Admin account is not authorized.' })
      const loginChallenge = jwt.sign({ sub: user._id.toString(), email: user.email, purpose: 'admin-login' }, getJwtSecret(), { expiresIn: '5m' })
      return res.json({ requiresOtp: true, loginChallenge, email: user.email, message: 'Password verified. Request an email OTP to finish signing in.' })
    }
    res.json({ requiresOtp: false, ...await createSession(user) })
  } catch (error) { next(error) }
}

export async function demoLogin(req, res, next) {
  try {
    if (!demoLoginIsEnabled(req)) {
      return res.status(404).json({ message: 'Demo login is disabled.' })
    }
    const email = String(req.body.email || '').trim().toLowerCase()
    const password = String(req.body.password || '')
    const demoEmail = String(process.env.DEMO_ADMIN_EMAIL || '').trim().toLowerCase()
    const expectedPassword = process.env.DEMO_ADMIN_PASSWORD
    if (!demoEmail || email !== demoEmail || !expectedPassword || password !== expectedPassword) return res.status(401).json({ message: 'Demo email or password is incorrect.' })
    if (!password || password.length < 12) return res.status(503).json({ message: 'Set a demo admin password with at least 12 characters.' })
    let user = await User.findOne({ email })
    if (!user) {
      user = await User.create({ name: 'Demo Admin', email, passwordHash: await bcrypt.hash(password, 12), role: 'admin' })
    } else if (user.role !== 'admin') {
      user.role = 'admin'
      user.passwordHash = await bcrypt.hash(password, 12)
      await user.save()
    }
    res.json({ ...await createSession(user), demo: true })
  } catch (error) { next(error) }
}

export async function sendLoginOtp(req, res, next) {
  try {
    const challenge = jwt.verify(req.body.loginChallenge, getJwtSecret())
    if (challenge.purpose !== 'admin-login' || !emailIsAllowed(challenge.email)) return res.status(403).json({ message: 'A valid admin password check is required.' })
    const user = await User.findById(challenge.sub)
    if (!user || user.role !== 'admin' || !emailIsAllowed(user.email)) return res.status(401).json({ message: 'This admin account is unavailable.' })
    await sendOtp(user.email, 'admin-login', 'Kani Metals admin login code', 'Use this code to complete your admin sign-in.')
    res.json({ message: `A login code was sent to ${user.email}.` })
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') return res.status(401).json({ message: 'Password verification expired. Sign in again.' })
    next(error)
  }
}

export async function verifyLoginOtp(req, res, next) {
  try {
    const challenge = jwt.verify(req.body.loginChallenge, getJwtSecret())
    if (challenge.purpose !== 'admin-login' || !emailIsAllowed(challenge.email)) return res.status(403).json({ message: 'A valid admin password check is required.' })
    if (!(await validateOtp(challenge.email, 'admin-login', req.body.otp))) return res.status(400).json({ message: 'The OTP is invalid, expired, or has reached its attempt limit.' })
    const user = await User.findById(challenge.sub)
    if (!user || user.role !== 'admin') return res.status(401).json({ message: 'This admin account is unavailable.' })
    res.json(await createSession(user))
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') return res.status(401).json({ message: 'Password verification expired. Sign in again.' })
    next(error)
  }
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
    const demoAdminEmails = [String(process.env.DEMO_ADMIN_EMAIL || '').toLowerCase(), 'demo.admin@localhost.test']
    if (user.role === 'admin' && !demoAdminEmails.includes(user.email)) return res.status(403).json({ message: 'The primary admin account cannot be deleted here.' })
    await AuthSession.deleteMany({ user: user._id })
    await user.deleteOne()
    res.json({ message: 'User deleted.' })
  } catch (error) { next(error) }
}
