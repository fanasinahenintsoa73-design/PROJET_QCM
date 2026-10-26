import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface FieldProps {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
  className?: string
}

export function Field({ label, htmlFor, hint, error, required, children, className }: FieldProps) {
  return (
    <div className={cn('w-full', className)}>
      <label className="form-label" htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-1 text-sale">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-2 text-[12px] leading-snug text-sale" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-2 text-[12px] leading-snug text-mute">{hint}</p>
      ) : null}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn('form-input', className)} {...props} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn('form-textarea', className)} {...props} />
  },
)
