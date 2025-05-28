import { notFound } from 'next/navigation'
import { getWorkflow } from '@/app/actions'
import dynamic from 'next/dynamic'

const WorkflowPlayground = dynamic(() => import('@/components/workflow-playground'), { ssr: false })

type PageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function Page({ params }: PageProps) {
  const { id } = await params
  
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
