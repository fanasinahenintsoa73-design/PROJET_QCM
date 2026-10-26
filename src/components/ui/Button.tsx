import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'white'
type Size = 'sm' | 'md' | 'lg'

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(
    'inline-flex select-none items-center justify-center gap-2 rounded-full font-medium transition duration-200 disabled:cursor-not-allowed disabled:opacity-40',
    'active:scale-[0.98]',
    size === 'sm' && 'h-10 px-5 text-[13px]',
    size === 'md' && 'h-12 px-7 text-[14px]',
    size === 'lg' && 'h-14 px-9 text-[15px]',
    variant === 'primary' && 'bg-ink text-white hover:bg-[#2a2a2a]',
    variant === 'secondary' && 'bg-cloud text-ink hover:bg-[#e9e9e9]',
    variant === 'outline' && 'border border-ink bg-transparent text-ink hover:bg-ink hover:text-white',
    variant === 'ghost' && 'bg-transparent text-ink hover:bg-cloud',
    variant === 'danger' && 'bg-sale text-white hover:bg-[#b00004]',
    variant === 'white' && 'bg-white text-ink hover:bg-[#f0f0f0]',
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
