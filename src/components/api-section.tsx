'use client'

import { useState, useEffect } from 'react'
import { Workflow } from '@/types/workflow'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Copy, Check } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ApiSectionProps {
  workflow: Pick<Workflow, 'id'> & {
    version?: number | null;
  };
  onVersionChange?: (version: string | null) => void;
}

export default function ApiSection({ workflow, onVersionChange }: ApiSectionProps) {
  const { toast } = useToast()
  const [inputData, setInputData] = useState('')
  const [inputId, setInputId] = useState('')
  const [manualInputId, setManualInputId] = useState('')
  const [version, setVersion] = useState(() => workflow.version?.toString() || '')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [hasCopied, setHasCopied] = useState<string | null>(null)

  // Update version when workflow version changes
  useEffect(() => {
    setVersion(workflow.version?.toString() || '')
  }, [workflow.version])

  // Update manual input ID when input ID changes
  useEffect(() => {
    if (inputId) {
      setManualInputId(inputId)
    }
  }, [inputId])

  // Notify parent component of version changes
  useEffect(() => {
    onVersionChange?.(version || null)
  }, [version, onVersionChange])

  const baseUrl = typeof window !== 'undefined' 
    ? `${window.location.protocol}//${window.location.host}`
    : ''

  const getInputEndpoint = () => {
    const base = `${baseUrl}/api/workflow/${workflow.id}/input`
    const versionToUse = version || workflow.version?.toString()
    return versionToUse ? `${base}?version=${versionToUse}` : base
  }

  const getOutputEndpoint = (id: string) => {
    const base = `${baseUrl}/api/workflow/${workflow.id}/output?input_id=${id}`
    const versionToUse = version || workflow.version?.toString()
    return versionToUse ? `${base}&version=${versionToUse}` : base
  }

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
      
      const response = await fetch(getInputEndpoint(), {
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
      const idToUse = manualInputId || inputId
      
      if (!idToUse) {
        throw new Error('No input ID provided')
      }
      
      console.log('Fetching output for ID:', idToUse)
      const endpoint = getOutputEndpoint(idToUse)
      console.log('Using endpoint:', endpoint)
      
      const response = await fetch(endpoint)
      console.log('Response status:', response.status)
      
      let errorData
      try {
        errorData = await response.json()
      } catch (e) {
        console.error('Failed to parse response as JSON:', e)
        throw new Error('Invalid response from server')
      }

      if (!response.ok) {
        console.error('Error response:', errorData)
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }

      if (!errorData || typeof errorData !== 'object') {
        console.error('Unexpected response format:', errorData)
        throw new Error('Unexpected response format from server')
      }

      // Extract the output from the response
      const outputData = errorData.output || {}
      setOutput(JSON.stringify(outputData, null, 2))
      
      if (Object.keys(outputData).length === 0) {
        console.warn('Received empty output data')
        setError('Received empty output from server')
      }
    } catch (err: any) {
      console.error('Error in handleGetOutput:', err)
      setError(err.message || 'Failed to get output')
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
            code={getInputEndpoint()}
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
            code={getOutputEndpoint(manualInputId || inputId || '{input_id}')}
            id="output-api"
          />
        </div>

        <div className="space-y-2">
          <Label>Input ID (Optional)</Label>
          <Input
            value={manualInputId}
            onChange={(e) => setManualInputId(e.target.value)}
            placeholder="Enter an existing input ID to test"
            className="font-mono"
          />
        </div>

        <div className="space-y-2">
          <Label>Version (Optional)</Label>
          <div className="flex gap-2">
            <Input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="Enter a workflow version number"
              className="font-mono"
              type="number"
            />
            {version && version !== workflow.version?.toString() && (
              <Button
                variant="outline"
                onClick={() => setVersion(workflow.version?.toString() || '')}
              >
                Reset to Current
              </Button>
            )}
          </div>
        </div>

        <Button 
          onClick={handleGetOutput} 
          disabled={!manualInputId && !inputId}
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