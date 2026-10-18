import ComingSoon from '../_components/ComingSoon'

export default function Page() {
  return (
    <ComingSoon
      title="Voice & AI Quality"
      description="Bengali voice recognition success rate and failed command review."
      needs="logging of voice transcription attempts and outcomes from src/lib/transcribeUtils.ts and useVoiceInput.ts, which isn't persisted anywhere today"
    />
  )
}
