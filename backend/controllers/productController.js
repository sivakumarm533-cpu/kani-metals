import Product from '../models/Product.js'
import { recordActivity } from '../utils/activity.js'

export async function listProducts(_req, res, next) {
  try { res.json(await Product.find().sort({ createdAt: -1 })) }
  catch (error) { next(error) }
}

export async function createProduct(req, res, next) {
  try {
    const product = await Product.create(req.body)
    await recordActivity(req, { action: 'create', entity: 'product', entityId: product._id, before: null, after: product })
    res.status(201).json(product)
  }
  catch (error) { next(error) }
}

export async function updateProduct(req, res, next) {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) return res.status(404).json({ message: 'Product not found.' })
    const before = product.toObject()
    product.set(req.body)
    await product.save()
    await recordActivity(req, { action: 'update', entity: 'product', entityId: product._id, before, after: product })
    res.json(product)
  } catch (error) { next(error) }
}

export async function deleteProduct(req, res, next) {
  try {
    const product = await Product.findByIdAndDelete(req.params.id)
    if (!product) return res.status(404).json({ message: 'Product not found.' })
    await recordActivity(req, { action: 'delete', entity: 'product', entityId: product._id, before: product, after: null })
    res.json({ message: 'Product deleted.' })
  } catch (error) { next(error) }
}
