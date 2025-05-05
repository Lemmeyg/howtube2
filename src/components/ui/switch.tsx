import * as React from 'react'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  id?: string
  className?: string
}

export const Switch: React.FC<SwitchProps> = ({ checked, onCheckedChange, id, className = '' }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    id={id}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${className} ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
    onClick={() => onCheckedChange(!checked)}
    tabIndex={0}
    onKeyDown={e => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        onCheckedChange(!checked)
      }
    }}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`}
    />
  </button>
)

export default Switch
