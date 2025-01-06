"use client"

import { useState, useRef, useEffect } from 'react'
import { Workflow } from '@/types/workflow'
import ApiSection from './api-section'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { X, Upload, Pencil } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Label } from './ui/label'

interface InputSectionProps {
  workflow: Pick<Workflow, 'id' | 'input_schema' | 'input_data' | 'version'>;
  onInputChange: (input: string[]) => void;
  onInputDataChange: (data: string) => void;
}

function extractAllKeys(data: any, prefix = ''): string[] {
  let keys: string[] = [];
  
  if (data && typeof data === 'object') {
    if (Array.isArray(data)) {
      // For arrays, add both the array itself and its first item's structure
      keys.push(prefix);
      if (data.length > 0) {
        keys = keys.concat(extractAllKeys(data[0], prefix));
      }
    } else {
      for (const key in data) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        keys.push(fullKey);
        
        if (data[key] && typeof data[key] === 'object') {
          keys = keys.concat(extractAllKeys(data[key], fullKey));
        }
      }
    }
  }
  
  return [...new Set(keys)];
}

export default function InputSection({ workflow, onInputChange, onInputDataChange }: InputSectionProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [testInput, setTestInput] = useState('')
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  // Convert input_schema to string array
  const inputSchema = Array.isArray(workflow.input_schema) 
    ? workflow.input_schema.filter((item): item is string => typeof item === 'string')
    : []

  // Update testInput when workflow.input_data changes
  useEffect(() => {
    if (typeof workflow.input_data === 'object' && workflow.input_data !== null) {
      setTestInput(JSON.stringify(workflow.input_data, null, 2))
    } else {
      setTestInput(workflow.input_data?.toString() || '')
    }
  }, [workflow.input_data])

  const handleAddInput = () => {
    if (inputValue && !inputSchema.includes(inputValue)) {
      const newInputs = [...inputSchema, inputValue]
      onInputChange(newInputs)
      setInputValue('')
    }
  }

  const handleRemoveInput = (input: string) => {
    const newInputs = inputSchema.filter(i => i !== input)
    onInputChange(newInputs)
  }

  const handleStartEdit = (input: string) => {
    setEditingField(input)
    setEditValue(input)
  }

  const handleSaveEdit = () => {
    if (editingField && editValue && !inputSchema.includes(editValue)) {
      const newInputs = inputSchema.map(i => 
        i === editingField ? editValue : i
      )
      onInputChange(newInputs)
      setEditingField(null)
      setEditValue('')
      toast({
        title: "Success",
        description: "Field name updated",
      })
    } else if (inputSchema.includes(editValue)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Field name already exists",
      })
    }
  }

  const handleInputDataChange = async (value: string) => {
    try {
      console.log('Handling input data change:', value)
      
      // Try parsing as JSON first to validate
      const jsonData = JSON.parse(value)
      if (typeof jsonData === 'object' && jsonData !== null) {
        // Extract all keys including nested ones
        const keys = extractAllKeys(jsonData)
        console.log('Extracted keys from JSON:', keys)
        
        // Update the input schema first
        onInputChange(keys)
        
        // Then store the raw input data
        onInputDataChange(value)
        
        // Show success toast
        toast({
          title: "Success",
          description: `Updated schema with ${keys.length} fields`,
        })
      }
    } catch (e) {
      console.error('Error parsing JSON:', e)
      // If not JSON, try CSV
      if (value.includes(',')) {
        const lines = value.trim().split('\n')
        if (lines[0]) {
          const headers = lines[0].split(',').map(h => h.trim()).filter(Boolean)
          console.log('Extracted headers from CSV:', headers)
          
          // Update the input schema first
          onInputChange(headers)
          
          // Convert CSV to JSON
          if (lines.length >= 2) {
            const values = lines[1].split(',')
            const jsonData: Record<string, string> = {}
            headers.forEach((header, index) => {
              jsonData[header.trim()] = values[index]?.trim() || ''
            })
            
            // Store the raw input data
            onInputDataChange(JSON.stringify(jsonData))
            
            // Show success toast
            toast({
              title: "Success",
              description: `Updated schema with ${headers.length} fields`,
            })
          }
        }
      } else {
        // Show error toast for invalid input
        toast({
          variant: "destructive",
          title: "Error",
          description: "Invalid input format. Please use JSON or CSV.",
        })
      }
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!file) return

    const fileType = file.name.split('.').pop()?.toLowerCase()
    if (!['json', 'csv'].includes(fileType || '')) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload a JSON or CSV file",
      })
      return
    }

    try {
      const text = await file.text()
      handleInputDataChange(text)
      toast({
        title: "Success",
        description: `File uploaded successfully`,
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to read file",
      })
      console.error('Error reading file:', error)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Input</h3>
      
      <Tabs defaultValue="text" className="w-full space-y-4">
        <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="text">Text</TabsTrigger>
            <TabsTrigger value="file">File</TabsTrigger>
            <TabsTrigger value="api">API</TabsTrigger>
        </TabsList>

        <TabsContent value="text">
          <div className="space-y-4">
            <Textarea
              placeholder="Copy and paste your test data in JSON or CSV"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              className="min-h-[200px] font-mono"
            />
            <Button 
              onClick={() => handleInputDataChange(testInput)}
              className="w-full"
            >
              Run Test
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="file">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragging ? 'border-primary bg-primary/10' : 'border-muted-foreground/25'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".json,.csv"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file)
              }}
            />
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drag and drop your file here
              </p>
              <p className="text-xs text-muted-foreground">
                Supports JSON and CSV files
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="api">
          <ApiSection 
            workflow={{ 
              id: workflow.id, 
              version: workflow.version 
            }} 
          />
        </TabsContent>
      </Tabs>

      <div className="space-y-4">
        <h4 className="text-sm font-medium">Input Schema</h4>

        <div className="space-y-2">
          {inputSchema.map((input, index) => (
            <div
              key={input}
              className="flex items-center gap-2 p-2 bg-muted rounded-md group"
            >
              <Input
                defaultValue={input}
                className="h-8 bg-transparent border-0 p-0 focus-visible:ring-1 focus-visible:ring-offset-0"
                onBlur={(e) => {
                  const newValue = e.target.value.trim()
                  if (newValue && newValue !== input && !inputSchema.includes(newValue)) {
                    const newInputs = [...inputSchema]
                    newInputs[index] = newValue
                    onInputChange(newInputs)
                    toast({
                      title: "Success",
                      description: "Field name updated",
                    })
                  } else if (inputSchema.includes(newValue) && newValue !== input) {
                    e.target.value = input
                    toast({
                      variant: "destructive",
                      title: "Error",
                      description: "Field name already exists",
                    })
                  } else {
                    e.target.value = input
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur()
                  } else if (e.key === 'Escape') {
                    e.currentTarget.value = input
                    e.currentTarget.blur()
                  }
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveInput(input)}
                className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 