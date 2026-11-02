import mongoose from 'mongoose'

export default async function connectDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/datadb'

  await mongoose.connect(mongoUri)
  console.log(`MongoDB connected to ${mongoose.connection.host}/${mongoose.connection.name}`)
  return true
}
