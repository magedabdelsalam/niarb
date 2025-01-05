export default function Loading() {
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