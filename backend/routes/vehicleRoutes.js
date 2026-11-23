import { Router } from 'express'
import { addEntry, createVehicle, deleteEntry, deleteVehicle, getVehicle, listVehicles, saveBaseCharges, updateVehicle } from '../controllers/vehicleController.js'

// Mounted behind requireFeature('vehicles') in server.js. Deleting a vehicle is for managers only (checked in the controller).
const router = Router()
router.get('/', listVehicles)
router.post('/', createVehicle)
router.delete('/entries/:entryId', deleteEntry)
router.get('/:id', getVehicle)
router.put('/:id', updateVehicle)
router.delete('/:id', deleteVehicle)
router.post('/:id/entries', addEntry)
router.put('/:id/base-charges', saveBaseCharges)

export default router
