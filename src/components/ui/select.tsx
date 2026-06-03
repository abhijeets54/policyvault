"use client"

/**
 * Select component — CSS/native-based implementation.
 * Note: @radix-ui/react-select is not installed in this project.
 * This implementation uses the native <select> element styled to match
 * the project's navy/amber design system.
 */

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────

interface SelectContextValue {
  value: string
  onValueChange: (value: string) => void
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  disabled?: boolean
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

function useSelectContext() {
  const ctx = React.useContext(SelectContext)
  if (!ctx) throw new Error("Select subcomponent used outside <Select>")
  return ctx
}

// ─────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────

interface SelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  children: React.ReactNode
}

function Select({
  value: controlledValue,
  defaultValue = "",
  onValueChange,
  disabled,
  children,
}: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const [open, setOpen] = React.useState(false)

  const value = controlledValue !== undefined ? controlledValue : internalValue

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      setInternalValue(newValue)
      onValueChange?.(newValue)
      setOpen(false)
    },
    [onValueChange]
  )

  return (
    <SelectContext.Provider
      value={{ value, onValueChange: handleValueChange, open, setOpen, disabled }}
    >
      <div className="relative w-full">{children}</div>
    </SelectContext.Provider>
  )
}

// ─────────────────────────────────────────────────────────────
// Trigger
// ─────────────────────────────────────────────────────────────

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const { open, setOpen, disabled } = useSelectContext()

  return (
    <button
      ref={ref}
      type="button"
      role="combobox"
      aria-expanded={open}
      disabled={disabled}
      onClick={() => setOpen((o) => !o)}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-slate-200",
        "bg-white px-3 py-2 text-sm ring-offset-background",
        "placeholder:text-slate-400",
        "focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "[&>span]:line-clamp-1",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown
        className={cn(
          "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
          open && "rotate-180"
        )}
      />
    </button>
  )
})
SelectTrigger.displayName = "SelectTrigger"

// ─────────────────────────────────────────────────────────────
// Value
// ─────────────────────────────────────────────────────────────

interface SelectValueProps {
  placeholder?: string
  className?: string
}

function SelectValue({ placeholder, className }: SelectValueProps) {
  const { value } = useSelectContext()
  return (
    <span className={cn("block truncate", !value && "text-slate-400", className)}>
      {value || placeholder}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// Content (dropdown)
// ─────────────────────────────────────────────────────────────

const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { open, setOpen } = useSelectContext()
  const overlayRef = React.useRef<HTMLDivElement>(null)

  // Close on outside click
  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        overlayRef.current &&
        !overlayRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open, setOpen])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className={cn(
        "absolute z-50 mt-1 w-full min-w-[8rem] overflow-hidden rounded-md",
        "border border-slate-200 bg-white shadow-lg",
        "animate-in fade-in-0 zoom-in-95",
        className
      )}
      {...props}
    >
      <div
        ref={ref}
        role="listbox"
        className="max-h-60 overflow-y-auto p-1"
      >
        {children}
      </div>
    </div>
  )
})
SelectContent.displayName = "SelectContent"

// ─────────────────────────────────────────────────────────────
// Item
// ─────────────────────────────────────────────────────────────

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  disabled?: boolean
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className, children, value, disabled, ...props }, ref) => {
    const { value: selectedValue, onValueChange } = useSelectContext()
    const isSelected = selectedValue === value

    return (
      <div
        ref={ref}
        role="option"
        aria-selected={isSelected}
        aria-disabled={disabled}
        onClick={() => {
          if (!disabled) onValueChange(value)
        }}
        className={cn(
          "relative flex w-full cursor-pointer select-none items-center rounded-sm",
          "py-1.5 pl-8 pr-2 text-sm outline-none",
          "hover:bg-[#1e3a5f]/10 focus:bg-[#1e3a5f]/10",
          isSelected && "bg-[#1e3a5f]/10 font-medium text-[#1e3a5f]",
          disabled && "pointer-events-none opacity-50",
          className
        )}
        {...props}
      >
        {isSelected && (
          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
            <svg
              className="h-4 w-4 text-[#1e3a5f]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </span>
        )}
        {children}
      </div>
    )
  }
)
SelectItem.displayName = "SelectItem"

// ─────────────────────────────────────────────────────────────
// Label
// ─────────────────────────────────────────────────────────────

const SelectLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "py-1.5 pl-8 pr-2 text-xs font-semibold text-slate-500 uppercase tracking-wider",
      className
    )}
    {...props}
  />
))
SelectLabel.displayName = "SelectLabel"

// ─────────────────────────────────────────────────────────────
// Separator
// ─────────────────────────────────────────────────────────────

const SelectSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-slate-100", className)}
    {...props}
  />
))
SelectSeparator.displayName = "SelectSeparator"

// ─────────────────────────────────────────────────────────────
// Group (pass-through)
// ─────────────────────────────────────────────────────────────

const SelectGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} role="group" className={cn(className)} {...props} />
))
SelectGroup.displayName = "SelectGroup"

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
}
