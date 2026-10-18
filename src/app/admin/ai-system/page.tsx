import ComingSoon from '../_components/ComingSoon'

export default function Page() {
  return (
    <ComingSoon
      title="AI System"
      description="Claude model usage, token spend, and error rates across the platform."
      needs="request-level logging of every /api/chat call (tokens in/out, latency, model, errors) - none of that is currently persisted"
    />
  )
}
