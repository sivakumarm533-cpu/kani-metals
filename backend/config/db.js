import mongoose from 'mongoose'

let connectionPromise

export default async function connectDB() {
  const mongoUri = process.env.MONGODB_URI
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not configured.')
  }

  if (mongoose.connection.readyState === 1) return mongoose.connection

  if (!connectionPromise) {
    // A small pool and fast server selection keep serverless cold starts short.
    connectionPromise = mongoose.connect(mongoUri, { maxPoolSize: 10, serverSelectionTimeoutMS: 8000, socketTimeoutMS: 30000 })
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
