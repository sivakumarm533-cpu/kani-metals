import { Router } from 'express'
import { createBill, deleteBill, listBills, updateBill } from '../controllers/billController.js'

const router = Router()
router.get('/', listBills)
router.post('/', createBill)
router.put('/:id', updateBill)
router.delete('/:id', deleteBill)

export default router
