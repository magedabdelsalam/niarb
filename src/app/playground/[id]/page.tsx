import { notFound } from 'next/navigation'
import { getWorkflow } from '@/app/actions'
import { WorkflowPlayground } from '@/components/workflow-playground'

type PageProps = {
  params: {
    id: string
  }
}

export default async function Page({ params }: PageProps) {
  const { id } = params
  
  try {
    const workflow = await getWorkflow(id)
    if (!workflow) {
      return notFound()
    }
    return <WorkflowPlayground initialWorkflow={workflow} />
  } catch (error) {
    console.error('Error loading workflow:', error)
    return notFound()
  }
}
