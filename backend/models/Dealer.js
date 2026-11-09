import mongoose from 'mongoose'

const dealerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  location: { type: String, trim: true, default: '' },
  category: { type: String, trim: true, default: 'Regular Dealer' },
  profileImage: { type: String, default: '' },
  cardColor: { type: String, default: '#fff3e8' },
  cardBackground: { type: String, default: '' },
  /** Money paid beyond a bill's balance, kept for this dealer and used on their next bill. */
  advancePaise: { type: Number, default: 0, min: 0 },
  /** Inactive dealers stay in history but cannot get new bills. */
  active: { type: Boolean, default: true },
}, { timestamps: true })

export default mongoose.model('Dealer', dealerSchema)
