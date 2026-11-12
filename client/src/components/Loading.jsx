import { Loader2Icon } from 'lucide-react'

const Loading = () => {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex h-screen w-full items-center justify-center bg-canvas text-ink animate-fade-in"
    >
      <Loader2Icon
        size={20}
        strokeWidth={1.5}
        className="animate-spin text-ink-secondary"
      />
    </div>
  )
}

export default Loading
