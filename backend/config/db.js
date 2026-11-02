import mongoose from 'mongoose'

let connectionPromise

export default async function connectDB() {
  const mongoUri = process.env.MONGODB_URI
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not configured.')
  }

  if (mongoose.connection.readyState === 1) return mongoose.connection

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(mongoUri)
      .then((connection) => {
        console.log(`MongoDB connected to ${connection.connection.host}/${connection.connection.name}`)
        return connection
      })
      .finally(() => {
        connectionPromise = undefined
      })
  }

  await connectionPromise
  return mongoose.connection
}
