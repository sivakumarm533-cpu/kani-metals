import { Router } from 'express'
import { clearManualPrice, createItem, deleteItem, getItemImage, getItemPriceDetail, listItemPrices, setItemImage, setManualPrice, setManualPrices } from '../controllers/itemPriceController.js'

const router = Router()
router.get('/', listItemPrices)
router.get('/detail', getItemPriceDetail)
router.get('/image', getItemImage)
router.put('/image', setItemImage)
router.post('/items', createItem)
router.delete('/items', deleteItem)
router.put('/manual', setManualPrice)
router.put('/manual/bulk', setManualPrices)
router.delete('/manual', clearManualPrice)

export default router
