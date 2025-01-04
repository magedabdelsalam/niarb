'use client'

import { useState } from 'react'
import { Workflow } from '@/types/workflow'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Copy, Check } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ApiSectionProps {
  workflow: Workflow
}

export default function ApiSection({ workflow }: ApiSectionProps) {
  const { toast } = useToast()
  const [inputData, setInputData] = useState('')
  const [inputId, setInputId] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [hasCopied, setHasCopied] = useState<string | null>(null)

  const baseUrl = typeof window !== 'undefined' 
    ? `${window.location.protocol}//${window.location.host}`
    : ''

  const inputEndpoint = `${baseUrl}/api/workflow/${workflow.id}/input`
  const outputEndpoint = `${baseUrl}/api/workflow/${workflow.id}/output?input_id={input_id}`

  async function copyToClipboard(text: string, key: string) {
    await navigator.clipboard.writeText(text)
    setHasCopied(key)
    toast({
      title: "Copied",
      description: "API endpoint copied to clipboard",
    })
    setTimeout(() => setHasCopied(null), 2000)
  }

  async function handleSubmitInput() {
    try {
      setError('')
      const parsedData = JSON.parse(inputData)
      
      const response = await fetch(inputEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsedData),
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit input')
      }

      setInputId(result.input_id)
      setOutput('')
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function handleGetOutput() {
    try {
      setError('')
      
      const response = await fetch(`${baseUrl}/api/workflow/${workflow.id}/output?input_id=${inputId}`)
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to get output')
      }

      setOutput(JSON.stringify(result.output, null, 2))
    } catch (err: any) {
      setError(err.message)
    }
  }

  function CodeBlock({ code, id }: { code: string, id: string }) {
    return (
      <Card className="relative group">
        <CardContent className="p-3 font-mono text-sm bg-muted">
          {code}
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => copyToClipboard(code, id)}
          >
            {hasCopied === id ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4">
        <Card className="p-4 space-y-4">
          <div className="space-y-2">
            <Label>Input API</Label>
            <CodeBlock 
              code={`${inputEndpoint}`}
              id="input-api"
            />
          </div>

          <div className="space-y-2">
            <Label>Request Body</Label>
            <Textarea
              value={inputData}
              onChange={(e) => setInputData(e.target.value)}
              className="font-mono"
              rows={6}
            />
          </div>

          <Button onClick={handleSubmitInput} className="w-full">
            Test Input API
          </Button>

          {inputId && (
            <div className="space-y-2">
              <Label>Input ID</Label>
              <CodeBlock 
                code={inputId}
                id="input-id"
              />
            </div>
          )}
        </Card>

        <Card className="p-4 space-y-4">
          <div className="space-y-2">
            <Label>Output API</Label>
            <CodeBlock 
              code={`${outputEndpoint}`}
              id="output-api"
            />
          </div>

          <Button 
            onClick={handleGetOutput} 
            disabled={!inputId}
            className="w-full"
          >
            Test Output API
          </Button>

          {output && (
            <div className="space-y-2">
              <Label>Response</Label>
              <CodeBlock 
                code={output}
                id="output-response"
              />
            </div>
          )}
        </Card>

      {error && (
        <div className="p-2 border border-destructive rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
    </div>
  )
} 