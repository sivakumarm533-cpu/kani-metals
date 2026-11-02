export function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32 || secret.toLowerCase().startsWith('replace-')) {
    const error = new Error('JWT_SECRET must be configured with a unique random value of at least 32 characters.')
    error.statusCode = 503
    throw error
  }
  return secret
}
