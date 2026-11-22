import { Router } from 'express'
import { addEntry, createEmployee, deleteEmployee, deleteEntry, getAttendanceSheet, getEmployee, listEmployees, saveAttendance, updateEmployee } from '../controllers/employeeController.js'

// Mounted behind requireAdmin in server.js: staff wages are for administrators and sub-admins only.
const router = Router()
router.get('/', listEmployees)
router.post('/', createEmployee)
router.get('/attendance', getAttendanceSheet)
router.put('/attendance', saveAttendance)
router.delete('/entries/:entryId', deleteEntry)
router.get('/:id', getEmployee)
router.put('/:id', updateEmployee)
router.delete('/:id', deleteEmployee)
router.post('/:id/entries', addEntry)

export default router
