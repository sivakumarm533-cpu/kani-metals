import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'
import { randomInt } from 'node:crypto'
import User from '../models/User.js'
import EmailVerification from '../models/EmailVerification.js'
import { getJwtSecret } from '../config/secrets.js'

const allowedAdminEmail = 'sivakumar.m533@gmail.com'
const emailIsAllowed = (email) => String(email || '').trim().toLowerCase() === allowedAdminEmail
const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email, role: user.role })

function signToken(user, expiresIn = '12h') {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, getJwtSecret(), { expiresIn })
}

export async function authStatus(_req, res, next) {
  try { res.json({ adminExists: await User.exists({ role: 'admin' }), signupEmail: allowedAdminEmail }) }
  catch (error) { next(error) }
}

export async function requestAdminVerification(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    if (!emailIsAllowed(email)) return res.status(403).json({ message: 'Admin signup is restricted to the authorized Gmail account.' })
    if (await User.exists({ role: 'admin' })) return res.status(409).json({ message: 'Admin setup is already complete. Sign in instead.' })
    if (!process.env.SMTP_USER || !process.env.SMTP_APP_PASSWORD) return res.status(503).json({ message: 'Email verification is not configured. Set SMTP_USER and SMTP_APP_PASSWORD on the backend.' })
    const previousRequest = await EmailVerification.findOne({ email })
    if (previousRequest && Date.now() - previousRequest.updatedAt.getTime() < 60_000) return res.status(429).json({ message: 'Wait one minute before requesting another verification code.' })

    const code = String(randomInt(100000, 1000000))
    await EmailVerification.findOneAndUpdate({ email }, {
      codeHash: await bcrypt.hash(code, 10),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    }, { upsert: true, new: true, setDefaultsOnInsert: true })
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_APP_PASSWORD },
    })
    await transporter.sendMail({
      from: `Kani Metals <${process.env.SMTP_USER}>`,
      to: allowedAdminEmail,
      subject: 'Your Kani Metals admin verification code',
      text: `Your verification code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`,
    })
    res.json({ message: `A verification code was sent to ${allowedAdminEmail}.` })
  } catch (error) { next(error) }
}

export async function verifyAdminEmail(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    const code = String(req.body.code || '').trim()
    if (!emailIsAllowed(email)) return res.status(403).json({ message: 'This email is not authorized for admin signup.' })
    const verification = await EmailVerification.findOne({ email })
    if (!verification || verification.expiresAt <= new Date() || verification.attempts >= 5) {
      return res.status(400).json({ message: 'The verification code is invalid or expired.' })
    }
    if (!(await bcrypt.compare(code, verification.codeHash))) {
      verification.attempts += 1
      await verification.save()
      return res.status(400).json({ message: 'The verification code is invalid or expired.' })
    }
    await EmailVerification.deleteOne({ _id: verification._id })
    const verificationToken = jwt.sign({ email, purpose: 'admin-signup' }, getJwtSecret(), { expiresIn: '10m' })
    res.json({ verificationToken })
  } catch (error) { next(error) }
}

export async function completeAdminSignup(req, res, next) {
  try {
    const { verificationToken, name, password } = req.body
    const verified = jwt.verify(verificationToken, getJwtSecret())
    if (verified.purpose !== 'admin-signup' || !emailIsAllowed(verified.email)) return res.status(403).json({ message: 'Admin email verification is required.' })
    if (typeof name !== 'string' || !name.trim() || typeof password !== 'string' || password.length < 12) return res.status(400).json({ message: 'Enter your name and a password with at least 12 characters.' })
    if (await User.exists({ role: 'admin' })) return res.status(409).json({ message: 'Admin setup is already complete.' })
    const user = await User.create({ name: name.trim(), email: allowedAdminEmail, passwordHash: await bcrypt.hash(password, 12), role: 'admin' })
    res.status(201).json({ token: signToken(user), user: publicUser(user) })
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') return res.status(401).json({ message: 'Email verification has expired. Request a new code.' })
    next(error)
  }
}

export async function login(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    const password = String(req.body.password || '')
    const user = await User.findOne({ email }).select('+passwordHash')
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Email or password is incorrect.' })
    res.json({ token: signToken(user), user: publicUser(user) })
  } catch (error) { next(error) }
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
    await user.deleteOne()
    res.json({ message: 'User deleted.' })
  } catch (error) { next(error) }
}
