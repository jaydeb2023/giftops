import ComingSoon from '../_components/ComingSoon'

export default function Page() {
  return (
    <ComingSoon
      title="Integrations"
      description="Manage connected third-party services (Razorpay, WhatsApp Business API, etc)."
      needs="a UI over the existing env vars / whatsapp_accounts table - connections currently live only in .env and can't be managed from here"
    />
  )
}
