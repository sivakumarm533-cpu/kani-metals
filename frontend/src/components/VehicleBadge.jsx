/** Photo of the vehicle, or a truck icon. */
export default function VehicleBadge({ vehicle, size = 44 }) {
  return (
    <span className="staff-avatar vehicle-badge" style={{ '--avatar-size': `${size}px` }} aria-hidden="true">
      {vehicle.photo ? <img src={vehicle.photo} alt="" loading="lazy" /> : <i className="bi bi-truck" />}
    </span>
  )
}
