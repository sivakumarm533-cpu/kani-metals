import { Router } from 'express'
import { createDealer, deleteDealer, listDealers, updateDealer } from '../controllers/dealerController.js'

const router = Router()
router.get('/', listDealers)
router.post('/', createDealer)
router.put('/:id', updateDealer)
router.delete('/:id', deleteDealer)

export default router
