import { notFound } from 'next/navigation'
import { getWorkflow } from '@/app/actions'
import { WorkflowPlayground } from '@/components/workflow-playground'

type PageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function Page({ params }: PageProps) {
  const { id } = await params
  
  try {
    const workflow = await getWorkflow(id)
    return <WorkflowPlayground initialWorkflow={workflow} />
  } catch (error) {
    notFound()
  }
} 