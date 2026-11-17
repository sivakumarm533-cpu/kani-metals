import { Router } from 'express'
import { createBill, deleteBill, getBillComparison, getBillDeleteSummary, listBills, updateBill } from '../controllers/billController.js'

const router = Router()
router.get('/compare', getBillComparison)
router.get('/', listBills)
router.post('/', createBill)
router.put('/:id', updateBill)
router.get('/:id/delete-summary', getBillDeleteSummary)
router.delete('/:id', deleteBill)

export default router
