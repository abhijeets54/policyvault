'use client'
// PolicyForm is replaced by VerificationForm (upload) and inline edit in /policies/[id]
// This shim prevents import errors from PolicyEditor.tsx (which is now deprecated)
export function PolicyForm({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}
