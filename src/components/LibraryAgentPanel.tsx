'use client'

import DokanManagerUI from '@/components/DokanManagerUI'
import PharmacyAssistantUI from '@/components/PharmacyAssistantUI'
import HotelDhabaManagerUI from '@/components/HotelDhabaManagerUI'
import MishtiDokanManagerUI from '@/components/MishtiDokanManagerUI'
import KaporDokanManagerUI from '@/components/KaporDokanManagerUI'

// Maps a Library agent's slug (see LIBRARY_AGENTS in src/app/dashboard/page.tsx,
// and the same 5 canonical slugs in src/app/library/[slug]/page.tsx's renderPanel)
// to its real, data-connected dashboard UI. Used so the exact same panel can be
// embedded inline inside the main dashboard shell (bottom-nav "এজেন্ট" tab),
// not just on the standalone /library/[slug] page.
export function renderLibraryAgentPanel(slug: string, userId: string, initialTab?: string) {
  switch (slug) {
    case 'dokan-manager':
      return <DokanManagerUI userId={userId} initialTab={initialTab} />
    case 'pharmacy-assistant':
      return <PharmacyAssistantUI userId={userId} />
    case 'hotel-and-dhaba-manager':
      return <HotelDhabaManagerUI userId={userId} />
    case 'mishti-dokan-manager':
      return <MishtiDokanManagerUI userId={userId} />
    case 'kaporer-dokan-tracker':
    case 'kaporer-dokan':
      return <KaporDokanManagerUI userId={userId} />
    default:
      return null
  }
}
