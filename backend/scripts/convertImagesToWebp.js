/*
 * One-time conversion of photos saved before WebP was enforced (JPG/PNG/GIF data URLs)
 * to WebP. New uploads are converted automatically (utils/webp.js).
 *
 *   npm run images:webp            -> report only, changes nothing
 *   npm run images:webp -- --apply -> convert and save
 *
 * Take a database backup (Settings → Database backup) before using --apply.
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { toWebpDataUrl } from '../utils/webp.js'

const apply = process.argv.includes('--apply')
const isOldImage = (value) => typeof value === 'string' && value.startsWith('data:image/') && !value.startsWith('data:image/webp')

// collection -> top-level image fields, plus the bill line images.
const targets = [
  { collection: 'users', fields: ['profilePicture'] },
  { collection: 'dealers', fields: ['profileImage', 'cardBackground'] },
  { collection: 'products', fields: ['image'] },
  { collection: 'itemprices', fields: ['image'] },
  { collection: 'bills', fields: [], items: true },
]

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set.')
  await mongoose.connect(process.env.MONGODB_URI)
  const db = mongoose.connection.db
  let found = 0
  let converted = 0
  let failed = 0
  let savedBytes = 0

  for (const { collection, fields, items } of targets) {
    const or = fields.map((field) => ({ [field]: { $regex: '^data:image/(?!webp)' } }))
    if (items) or.push({ 'items.image': { $regex: '^data:image/(?!webp)' } })
    const cursor = db.collection(collection).find({ $or: or }, { projection: { ...Object.fromEntries(fields.map((f) => [f, 1])), ...(items ? { items: 1 } : {}) } })
    for await (const doc of cursor) {
      const set = {}
      for (const field of fields) {
        if (!isOldImage(doc[field])) continue
        found += 1
        try { set[field] = await toWebpDataUrl(doc[field]); savedBytes += doc[field].length - set[field].length } catch { failed += 1 }
      }
      if (items && Array.isArray(doc.items)) {
        let changed = false
        const nextItems = []
        for (const line of doc.items) {
          if (!isOldImage(line?.image)) { nextItems.push(line); continue }
          found += 1
          try {
            const image = await toWebpDataUrl(line.image)
            savedBytes += line.image.length - image.length
            nextItems.push({ ...line, image })
            changed = true
          } catch { failed += 1; nextItems.push(line) }
        }
        if (changed) set.items = nextItems
      }
      if (!Object.keys(set).length) continue
      converted += Object.keys(set).length
      if (apply) await db.collection(collection).updateOne({ _id: doc._id }, { $set: set })
    }
    console.log(`${collection}: checked`)
  }

  console.log(`\nOld-format images found: ${found}${failed ? ` (${failed} could not be read and were left as they are)` : ''}`)
  console.log(`Space saved: about ${(savedBytes / 1024 / 1024).toFixed(1)} MB`)
  console.log(apply ? `Converted and saved (${converted} fields).` : 'Nothing was changed. Run again with --apply to convert.')
  await mongoose.disconnect()
}

main().catch(async (error) => {
  console.error(error.message)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})
