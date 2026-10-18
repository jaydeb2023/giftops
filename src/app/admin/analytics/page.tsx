import ComingSoon from '../_components/ComingSoon'

export default function Page() {
  return (
    <ComingSoon
      title="Analytics"
      description="Deeper product analytics beyond the Dashboard overview."
      needs="an event-tracking pipeline (page views, feature usage, funnels) - right now the DB only has end-state rows (agents, subscriptions), not user activity events"
    />
  )
}
