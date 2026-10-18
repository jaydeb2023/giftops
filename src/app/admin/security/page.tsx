import ComingSoon from '../_components/ComingSoon'

export default function Page() {
  return (
    <ComingSoon
      title="Security"
      description="Login activity, sessions, and security alerts."
      needs="access to auth.users session/sign-in-log data via the Supabase Admin API, which isn't wired up yet"
    />
  )
}
