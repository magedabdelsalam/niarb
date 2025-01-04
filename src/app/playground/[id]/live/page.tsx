import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import LiveCharts from './live-charts'
import ApiSection from '@/components/api-section'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Suspense } from 'react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

async function getWorkflow(id: string) {
  const supabase = createClient()
  const { data: workflow, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching workflow:', error)
    return null
  }

  return workflow
}

async function getLiveData(id: string) {
  const supabase = createClient()
  const { data: inputs, error } = await supabase
    .from('workflow_inputs')
    .select('*')
    .eq('workflow_id', id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Error fetching live data:', error)
    return []
  }

  return inputs
}

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: { [key: string]: string | string[] | undefined }
}

export default async function LivePage({ params, searchParams }: PageProps) {
  const { id } = await params
  const workflow = await getWorkflow(id)
  const inputs = await getLiveData(id)

  if (!workflow) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold hover:opacity-80 transition-opacity">
          NIARB
        </Link>
        <h1 className="text-xl font-medium">{workflow.name}</h1>
        <div className="space-x-2">
          <Button variant="outline" asChild>
            <Link href={`/playground/${id}`}>
              Workflow
            </Link>
          </Button>
        </div>
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
          <ApiSection workflow={workflow} />
        </TabsContent>
      </Tabs>
    </div>
  )
} 