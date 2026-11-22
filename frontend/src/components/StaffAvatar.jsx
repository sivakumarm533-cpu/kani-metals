import { initials } from '../utils/staff.js'

/** Employee photo, or their initials when there is none. */
export default function StaffAvatar({ employee, size = 40 }) {
  return (
    <span className="staff-avatar" style={{ width: size, height: size, flexBasis: size }} aria-hidden="true">
      {employee.photo ? <img src={employee.photo} alt="" loading="lazy" /> : initials(employee.name)}
    </span>
  )
}
