import mongoose from 'mongoose'

const activityChangeSchema = new mongoose.Schema({
  field: { type: String, required: true },
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after: { type: mongoose.Schema.Types.Mixed, default: null },
}, { _id: false })

const activityLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actorName: { type: String, required: true },
  actorEmail: { type: String, required: true },
  action: { type: String, enum: ['create', 'update', 'delete'], required: true },
  entity: { type: String, enum: ['dealer', 'product', 'bill', 'payment', 'user', 'backup', 'settings'], required: true },
  entityId: { type: String, default: '' },
  entityLabel: { type: String, default: '' },
  changes: { type: [activityChangeSchema], default: [] },
}, { timestamps: true })

activityLogSchema.index({ createdAt: -1 })
activityLogSchema.index({ actor: 1, createdAt: -1 })
activityLogSchema.index({ entity: 1, createdAt: -1 })

export default mongoose.model('ActivityLog', activityLogSchema)
