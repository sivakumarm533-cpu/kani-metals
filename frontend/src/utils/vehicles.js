/** Labels and formatting for the Vehicles screens. Money from the API is in paise. */
import { formatPaise } from './staff.js'

export const FUEL_TYPES = [['diesel', 'Diesel'], ['petrol', 'Petrol'], ['cng', 'CNG'], ['electric', 'Electric'], ['other', 'Other']]
export const fuelLabel = (id) => FUEL_TYPES.find(([key]) => key === id)?.[1] || ''

export const VEHICLE_ENTRY_TYPES = [
  { id: 'fuel', label: 'Fuel', verb: 'Add fuel', icon: 'bi-fuel-pump', help: 'Fill the tank full each time and note the odometer for accurate mileage.' },
  { id: 'service', label: 'Service / repair', verb: 'Service / repair', icon: 'bi-wrench-adjustable', help: 'Servicing, repairs, tyres, spare parts.' },
  { id: 'daily', label: 'Daily use', verb: 'Daily use', icon: 'bi-calendar-day', help: 'Everyday running charges: driver bata, toll, parking, loading, washing.', suggestions: ['Driver bata', 'Toll', 'Parking', 'Loading / unloading', 'Washing'] },
  { id: 'expense', label: 'Other expense', verb: 'Other expense', icon: 'bi-receipt', help: 'One-off costs such as a fine, permit renewal or a document fee.' },
]
export const vehicleEntryInfo = (id) => VEHICLE_ENTRY_TYPES.find((type) => type.id === id)

/** Common fixed costs offered as one-tap choices in the base charges editor. */
export const BASE_CHARGE_PRESETS = ['Insurance', 'EMI', 'Road tax', 'Permit', 'FC / fitness', 'Parking rent']

/** Monthly share of one base charge, in paise. */
export const baseMonthly = (charge) => (charge.period === 'year' ? Math.round(charge.amountPaise / 12) : charge.amountPaise)

const kmFormat =new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
export const formatKm = (value) => `${kmFormat.format(Number(value) || 0)} km`
export const perKm = (paise) => (paise === null || paise === undefined ? '—' : `${formatPaise(paise)}/km`)
export const mileageText = (value) => (value ? `${value} km/L` : '—')
