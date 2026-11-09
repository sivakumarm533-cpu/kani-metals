import { Router } from 'express'
import { createInventoryItem, stockHistory, updateStock } from '../controllers/inventoryController.js'

const router = Router()
router.post('/items', createInventoryItem)
router.patch('/stock', updateStock)
router.get('/items/:id/history', stockHistory)

export default router
