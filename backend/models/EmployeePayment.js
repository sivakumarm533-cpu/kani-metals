import mongoose from 'mongoose'

/**
 * Entries in an employee's wage account:
 * - payment:   wages or salary paid out (lowers the balance due)
 * - advance:   money given ahead of wages (lowers the balance due)
 * - bonus:     extra earnings added (raises the balance due)
 * - deduction: earnings taken off, e.g. a fine or damage (lowers the balance due)
 */
export const EMPLOYEE_ENTRY_TYPES = ['payment', 'advance', 'bonus', 'deduction']
export const EMPLOYEE_PAYMENT_METHODS = ['cash', 'gpay', 'phonepe', 'paytm', 'upi_other', 'net_banking', 'cheque', 'bank_deposit', 'other']

const employeePaymentSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  type: { type: String, enum: EMPLOYEE_ENTRY_TYPES, required: true },
  amountPaise: { type: Number, required: true, min: 1 },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  paymentMethod: { type: String, enum: [...EMPLOYEE_PAYMENT_METHODS, ''], default: '' },
  notes: { type: String, trim: true, maxlength: 500, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

employeePaymentSchema.index({ employee: 1, date: -1 })

export default mongoose.model('EmployeePayment', employeePaymentSchema)
