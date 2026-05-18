import { cn } from '../../lib/utils'

type BadgeVariant = 'accent' | 'warning' | 'success' | 'danger' | 'muted'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  accent: 'text-orange-400 border-orange-500',
  warning: 'text-yellow-400 border-yellow-500',
  success: 'text-green-400 border-green-600',
  danger: 'text-red-400 border-red-500',
  muted: 'text-zinc-400 border-zinc-600',
}

export function Badge({ variant = 'muted', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-block border rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
