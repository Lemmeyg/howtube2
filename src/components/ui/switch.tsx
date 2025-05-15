import * as React from 'react'

interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'checked'> {
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => (
    <label className={'inline-flex items-center cursor-pointer relative ' + (className || '')}>
      <input
        type="checkbox"
        className="sr-only peer"
        ref={ref}
        checked={checked}
        onChange={e => onCheckedChange?.(e.target.checked)}
        {...props}
      />
      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
      <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-5"></div>
    </label>
  )
)

Switch.displayName = 'Switch'
