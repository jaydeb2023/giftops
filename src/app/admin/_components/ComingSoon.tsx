import { Construction } from 'lucide-react'

export default function ComingSoon({
  title,
  description,
  needs,
}: {
  title: string
  description: string
  needs?: string
}) {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{title}</h1>
      <p className="text-gray-400 text-sm mb-6">{description}</p>

      <div className="bg-white border border-dashed border-violet-200 rounded-2xl p-8 flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-violet-50 flex items-center justify-center">
          <Construction size={22} className="text-violet-500" />
        </div>
        <p className="font-semibold text-gray-800">Not built yet</p>
        <p className="text-sm text-gray-500 max-w-md">
          This section isn't wired to real data yet, so nothing is shown here rather than made up.
          {needs && (
            <>
              {' '}
              To make it real we'd need: <span className="font-medium text-gray-700">{needs}</span>.
            </>
          )}
        </p>
      </div>
    </div>
  )
}
