import { Router } from 'express'
import { addEntry, createEmployee, deleteEmployee, deleteEntry, getAttendanceSheet, getEmployee, listEmployees, saveAttendance, updateEmployee } from '../controllers/employeeController.js'

// Mounted behind requireAdmin in server.js: staff wages are for administrators and sub-admins only.
const router = Router()
router.get('/', listEmployees)
router.post('/', createEmployee)
router.delete('/entries/:entryId', deleteEntry)
router.get('/:id', getEmployee)
router.put('/:id', updateEmployee)
router.delete('/:id', deleteEmployee)
router.post('/:id/entries', addEntry)

export default router

/**
 * The daily attendance sheet. Mounted with requireFeature('attendance') so team members
 * given "Employee attendance" can mark attendance (they never see wages or payments).
 */
export const attendanceRouter = Router()
attendanceRouter.get('/', getAttendanceSheet)
attendanceRouter.put('/', saveAttendance)
