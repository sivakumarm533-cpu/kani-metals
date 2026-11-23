import mongoose from 'mongoose'

/**
 * Running costs of a vehicle:
 * - fuel:    a fuel fill (litres and odometer let us work out mileage)
 * - service: a service or repair
 * - daily:   day-to-day running charges (driver bata, toll, parking, loading, washing…)
 * - expense: anything else (insurance, permit, tax, fines…)
 */
export const VEHICLE_ENTRY_TYPES = ['fuel', 'service', 'daily', 'expense']

const vehicleEntrySchema = new mongoose.Schema({
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  type: { type: String, enum: VEHICLE_ENTRY_TYPES, required: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  amountPaise: { type: Number, required: true, min: 0 },
  /** Fuel only. */
  litres: { type: Number, default: 0, min: 0 },
  /** Odometer reading in km at the time of the entry; 0 when not noted. */
  odometerKm: { type: Number, default: 0, min: 0 },
  notes: { type: String, trim: true, maxlength: 500, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

vehicleEntrySchema.index({ vehicle: 1, date: -1 })

export default mongoose.model('VehicleEntry', vehicleEntrySchema)
