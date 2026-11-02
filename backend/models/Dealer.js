import mongoose from 'mongoose'

const dealerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  location: { type: String, trim: true, default: '' },
  category: { type: String, trim: true, default: 'Regular Dealer' },
  profileImage: { type: String, default: '' },
  cardColor: { type: String, default: '#fff3e8' },
  cardBackground: { type: String, default: '' },
}, { timestamps: true })

export default mongoose.model('Dealer', dealerSchema)
