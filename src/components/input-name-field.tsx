'use client'

import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Command as CommandPrimitive } from 'cmdk'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

type InputNameFieldProps = {
  value: string
  onChange: (value: string) => void
  onNameChange?: (oldName: string, newName: string) => void
  availableInputs: string[]
  className?: string
}

export function InputNameField({ value, onChange, onNameChange, availableInputs, className }: InputNameFieldProps) {
  const handleSelect = (currentValue: string) => {
    if (onNameChange && value && value !== currentValue) {
      onNameChange(value, currentValue)
    }
    onChange(currentValue)
    setOpen(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    onChange(e.target.value)
  }

  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')

  const filteredInputs = React.useMemo(() => {
    const searchLower = search.toLowerCase()
    return (availableInputs || []).filter(input => 
      input.toLowerCase().includes(searchLower)
    )
  }, [search, availableInputs])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between', className)}
        >
          {value || 'Select input...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" side="bottom" align="start" sideOffset={4}>
        <div className="rounded-lg border shadow-md">
          <div className="overflow-hidden rounded-lg">
            <div className="flex items-center border-b px-3">
              <input
                placeholder="Search inputs..."
                value={search}
                onChange={handleInputChange}
                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            {filteredInputs.length === 0 && (
              <div className="py-6 text-center text-sm">No input found.</div>
            )}
            {filteredInputs.length > 0 && (
              <div className="px-1 py-2">
                {filteredInputs.map((input, index) => (
                  <div
                    key={`${input}-${index}`}
                    onClick={() => {
                      handleSelect(input)
                      setOpen(false)
                    }}
                    className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === input ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {input}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
} 