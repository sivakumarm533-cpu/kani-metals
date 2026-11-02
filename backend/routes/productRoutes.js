import { Router } from 'express'
import { createProduct, deleteProduct, listProducts, updateProduct } from '../controllers/productController.js'

const router = Router()
router.get('/', listProducts)
router.post('/', createProduct)
router.put('/:id', updateProduct)
router.delete('/:id', deleteProduct)

export default router
