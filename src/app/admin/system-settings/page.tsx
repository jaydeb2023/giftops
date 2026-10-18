import ComingSoon from '../_components/ComingSoon'

export default function Page() {
  return (
    <ComingSoon
      title="System Settings"
      description="Platform-wide configuration (plan pricing, trial length, feature flags)."
      needs="a settings table - pricing/trial length are currently hardcoded in src/lib/planLimits.ts and the signup DB trigger, not database-driven"
    />
  )
}
