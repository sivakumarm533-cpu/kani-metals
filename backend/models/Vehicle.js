import mongoose from 'mongoose'

export const FUEL_TYPES = ['diesel', 'petrol', 'cng', 'electric', 'other']

export const BASE_CHARGE_PERIODS = ['month', 'year']

/**
 * A fixed cost the vehicle has whether it runs or not: insurance, EMI, road tax, permit, FC…
 * Yearly charges count 1/12 in each month. `from`/`to` are YYYY-MM; an empty `to` means "still paying".
 */
const baseChargeSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true, maxlength: 60 },
  amountPaise: { type: Number, required: true, min: 1 },
  period: { type: String, enum: BASE_CHARGE_PERIODS, default: 'month' },
  from: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
  to: { type: String, default: '', match: /^(\d{4}-\d{2})?$/ },
})

/** A vehicle used by the business (pickup, delivery, owner's car…). */
const vehicleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  /** Registration number, e.g. TN 38 AB 1234. */
  number: { type: String, trim: true, uppercase: true, maxlength: 20, default: '' },
  /** Kind of vehicle, e.g. Tata Ace, Bike, Lorry. */
  kind: { type: String, trim: true, maxlength: 60, default: '' },
  fuelType: { type: String, enum: FUEL_TYPES, default: 'diesel' },
  photo: { type: String, default: '' },
  active: { type: Boolean, default: true },
  notes: { type: String, trim: true, maxlength: 1000, default: '' },
  /** Fixed daily-use charge (driver bata, toll…) added with one tap from the vehicle list; 0 = not set. */
  dailyChargePaise: { type: Number, default: 0, min: 0 },
  baseCharges: { type: [baseChargeSchema], default: [] },
}, { timestamps: true })

vehicleSchema.index({ active: -1, name: 1 })

export default mongoose.model('Vehicle', vehicleSchema)
