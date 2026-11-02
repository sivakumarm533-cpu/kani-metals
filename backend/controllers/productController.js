import Product from '../models/Product.js'

export async function listProducts(_req, res, next) {
  try { res.json(await Product.find().sort({ createdAt: -1 })) }
  catch (error) { next(error) }
}

export async function createProduct(req, res, next) {
  try { res.status(201).json(await Product.create(req.body)) }
  catch (error) { next(error) }
}

export async function updateProduct(req, res, next) {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!product) return res.status(404).json({ message: 'Product not found.' })
    res.json(product)
  } catch (error) { next(error) }
}

export async function deleteProduct(req, res, next) {
  try {
    const product = await Product.findByIdAndDelete(req.params.id)
    if (!product) return res.status(404).json({ message: 'Product not found.' })
    res.json({ message: 'Product deleted.' })
  } catch (error) { next(error) }
}
