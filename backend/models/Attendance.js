import mongoose from 'mongoose'

export const ATTENDANCE_STATUSES = ['present', 'absent', 'half_day', 'leave', 'holiday']

/** One employee on one day. Dates are plain YYYY-MM-DD strings (the shop's local day). */
const attendanceSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
  overtimeHours: { type: Number, default: 0, min: 0, max: 24 },
  note: { type: String, trim: true, maxlength: 200, default: '' },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true })
attendanceSchema.index({ date: 1 })

export default mongoose.model('Attendance', attendanceSchema)
