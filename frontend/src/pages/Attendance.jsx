import AttendanceSheet from '../components/StaffAttendanceSheet.jsx'
import Toast from '../components/Toast.jsx'
import { PageHeader } from '../components/ui.jsx'
import { useToast } from '../hooks/useToast.js'
import './Employees.css'

/**
 * Employee attendance for team members an administrator gave the "Employee attendance" screen.
 * They mark the daily sheet only; wages, payments and employee pages stay with managers.
 */
export default function Attendance() {
  const [toast, notify] = useToast()
  return (
    <section className="page-container staff-page staff-member-attendance">
      <Toast toast={toast} />
      <PageHeader eyebrow="STAFF" title="Employee attendance" description="Mark who came to work today. Tap a mark again to clear it, then save." />
      <AttendanceSheet notify={notify} reloadKey={0} />
    </section>
  )
}
