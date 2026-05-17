import { cn } from '../../lib/utils'

type ButtonVariant = 'default' | 'ghost' | 'danger' | 'outline'
type ButtonSize = 'sm' | 'md'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantClasses: Record<ButtonVariant, string> = {
  default: 'bg-orange-500 text-white hover:bg-orange-400 disabled:opacity-50',
  ghost: 'bg-transparent text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100',
  danger: 'bg-transparent text-red-400 border border-red-500 hover:bg-red-950',
  outline: 'bg-transparent text-zinc-300 border border-zinc-600 hover:bg-zinc-700',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
}

export function Button({
  variant = 'default',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded font-medium cursor-pointer transition-colors disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  )
}
