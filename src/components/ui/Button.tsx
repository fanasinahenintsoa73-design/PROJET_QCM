import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'white'
type Size = 'sm' | 'md' | 'lg'

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(
    'inline-flex select-none items-center justify-center gap-2 rounded-[10px] font-medium transition duration-200 disabled:cursor-not-allowed disabled:opacity-45',
    'active:translate-y-px',
    size === 'sm' && 'h-9 px-4 text-[13px]',
    size === 'md' && 'h-11 px-5 text-[14px]',
    size === 'lg' && 'h-[52px] px-6 text-[15px]',
    variant === 'primary' && 'bg-accent text-white hover:bg-accent-deep',
    variant === 'secondary' && 'border border-line bg-surface text-ink hover:border-accent hover:text-accent',
    variant === 'outline' && 'border border-accent bg-transparent text-accent hover:bg-accent hover:text-white',
    variant === 'ghost' && 'bg-transparent text-ink hover:bg-cloud',
    variant === 'danger' && 'bg-sale text-white hover:bg-[#951d14]',
    variant === 'white' && 'bg-white text-ink hover:bg-cloud',
    className,
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, children, loading, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
})

export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: {
  to: string
  variant?: Variant
  size?: Size
  className?: string
  children: ReactNode
} & Omit<React.ComponentProps<typeof Link>, 'to' | 'className' | 'children'>) {
  return (
    <Link to={to} className={buttonClasses(variant, size, className)} {...props}>
      {children}
    </Link>
  )
}
