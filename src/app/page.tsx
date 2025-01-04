import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getWorkflows } from './actions'
import { formatDistanceToNow } from 'date-fns'
import { WorkflowList } from '@/components/workflow-list'

export default async function Home() {
  const initialWorkflows = await getWorkflows()

  return (
    <main className="container mx-auto p-4 max-w-[600px]">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">NIARB</h1>
        <Link href="/playground">
          <Button>+ New Workflow</Button>
        </Link>
      </div>

      <WorkflowList initialWorkflows={initialWorkflows} />
    </main>
  )
}

// Add loading state
export function Loading() {
  return (
    <div className="container mx-auto p-4">
      <div className="animate-pulse">
        <div className="h-8 w-48 bg-muted rounded mb-8" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-4">
              <div className="h-6 w-1/3 bg-muted rounded mb-2" />
              <div className="h-4 w-1/4 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Add error state
export function Error() {
  return (
    <div className="container mx-auto p-4">
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-destructive">
          Something went wrong
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Please try again later
        </p>
      </div>
    </div>
  )
}
