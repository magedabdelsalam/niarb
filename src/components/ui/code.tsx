'use client'

import * as React from 'react'
import { Button } from './button'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CodeProps extends React.HTMLAttributes<HTMLPreElement> {
  code: string
}

export function Code({ code, className, ...props }: CodeProps) {
  const [hasCopied, setHasCopied] = React.useState(false)

  async function copyToClipboard() {
    await navigator.clipboard.writeText(code)
    setHasCopied(true)
    setTimeout(() => setHasCopied(false), 2000)
  }

  return (
    <div className="relative group">
      <pre
        className={cn(
          "bg-muted px-4 py-3 font-mono text-sm rounded-md",
          className
        )}
        {...props}
      >
        {code}
      </pre>
      <Button
        size="icon"
        variant="ghost"
        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={copyToClipboard}
      >
        {hasCopied ? (
          <Check className="h-4 w-4" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
} 