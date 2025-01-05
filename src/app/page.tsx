import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getWorkflows } from './actions'
import { formatDistanceToNow } from 'date-fns'
import { WorkflowList } from '@/components/workflow-list'

export const dynamic = 'force-dynamic'

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
