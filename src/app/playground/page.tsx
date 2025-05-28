import dynamic from 'next/dynamic'

const WorkflowPlayground = dynamic(() => import('@/components/workflow-playground'), { ssr: false })

export default function PlaygroundPage() {
  return <WorkflowPlayground />
} 