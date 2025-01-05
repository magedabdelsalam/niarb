'use client'

export default function Error() {
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