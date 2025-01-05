'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Suspense } from 'react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import LiveCharts from './live-charts'
import ApiSection from '@/components/api-section'
import { Database } from '@/types/supabase'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "@/hooks/use-toast"

type Workflow = Database['public']['Tables']['workflows']['Row']

interface LivePageContentProps {
  workflow: Workflow
  inputs: any[]
}

export default function LivePageContent({ workflow, inputs }: LivePageContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Update URL when version changes
  const handleVersionChange = (version: string | null) => {
    // Do nothing - version changes no longer update URL
  }

  const handleExport = (format: 'json' | 'csv' | 'excel') => {
    if (inputs.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No data to export",
      })
      return
    }

    try {
      let content: string
      let filename: string
      let type: string

      switch (format) {
        case 'json':
          content = JSON.stringify(inputs, null, 2)
          filename = `${workflow.name}_monitoring_data.json`
          type = 'application/json'
          break
        case 'csv':
          // Convert the data to CSV format
          const headers = ['timestamp', 'input_id', 'version', 'input_data', 'logic_data', 'output_data']
          const rows = inputs.map(item => [
            new Date(item.created_at).toISOString(),
            item.id,
            item.workflow_version || 'Latest',
            JSON.stringify(item.input_data),
            JSON.stringify(item.logic_data),
            JSON.stringify(item.output_data)
          ])
          content = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
          filename = `${workflow.name}_monitoring_data.csv`
          type = 'text/csv'
          break
        case 'excel':
          // For Excel, we'll use CSV format but with .xlsx extension
          const excelHeaders = ['timestamp', 'input_id', 'version', 'input_data', 'logic_data', 'output_data']
          const excelRows = inputs.map(item => [
            new Date(item.created_at).toISOString(),
            item.id,
            item.workflow_version || 'Latest',
            JSON.stringify(item.input_data),
            JSON.stringify(item.logic_data),
            JSON.stringify(item.output_data)
          ])
          content = [excelHeaders.join(','), ...excelRows.map(row => row.join(','))].join('\n')
          filename = `${workflow.name}_monitoring_data.xlsx`
          type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          break
      }

      const blob = new Blob([content], { type })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: "Success",
        description: `Data exported as ${format.toUpperCase()}`,
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to export as ${format.toUpperCase()}`,
      })
      console.error('Error exporting data:', error)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Link href="/" className="text-2xl font-bold hover:opacity-80 transition-opacity">
            NIARB
            </Link>
            <Button variant="outline" asChild>
                <Link href={`/playground/${workflow.id}`}>
                Workflow
                </Link>
            </Button>
        </div>
          <h1 className="text-xl font-medium">{workflow.name}</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Export</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => handleExport('json')}>
              Export as JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('csv')}>
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('excel')}>
              Export as Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      
      <Tabs defaultValue="monitor" className="w-full">
        <TabsList>
          <TabsTrigger value="monitor">Live Monitoring</TabsTrigger>
          <TabsTrigger value="test">API Testing</TabsTrigger>
        </TabsList>
        
        <TabsContent value="monitor" className="mt-6">
          <Suspense fallback={<LoadingSpinner />}>
            <LiveCharts workflow={workflow} initialData={inputs} />
          </Suspense>
        </TabsContent>
        
        <TabsContent value="test" className="mt-6">
          <ApiSection 
            workflow={workflow} 
            onVersionChange={handleVersionChange}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
} 