'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { ShoppingBag, MessageCircle, Loader2, Store } from 'lucide-react'

interface Product {
  id: string
  name: string
  description: string
  price: number
  image_url: string | null
  category: string
}

interface Settings {
  user_id: string
  store_name: string
  tagline: string
  whatsapp_number: string
  theme_color: string
  logo_url: string | null
  is_published: boolean
}

export default function PublicCatalogPage() {
  const params = useParams()
  // The link is /catalog/<business-name>. Old links with the account id keep working.
  const slugParam = decodeURIComponent((params?.slug as string) || '')

  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    if (!slugParam) return
    ;(async () => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugParam)
      const base = supabase.from('catalog_settings').select('*').eq('is_published', true)
      const { data: settingsRow } = await (isUuid
        ? base.eq('user_id', slugParam)
        : base.eq('slug', slugParam.toLowerCase())
      ).maybeSingle()
      setSettings(settingsRow as Settings | null)
      if (settingsRow) {
        const { data: prods } = await supabase.from('catalog_products').select('*')
          .eq('user_id', (settingsRow as Settings).user_id).eq('is_active', true)
          .order('created_at', { ascending: false })
        if (prods) setProducts(prods as Product[])
      }
      setLoading(false)
    })()
  }, [slugParam])

  const orderOnWhatsApp = (p?: Product) => {
    if (!settings?.whatsapp_number) return
    const number = settings.whatsapp_number.replace(/[^0-9]/g, '')
    const msg = p
      ? `নমস্কার! আমি "${p.name}" (₹${Number(p.price).toFixed(0)}) অর্ডার করতে চাই।`
      : `নমস্কার! আমি ${settings.store_name}-এর ক্যাটালগ থেকে অর্ডার করতে চাই।`
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-gray-400" size={28} />
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center px-4">
        <ShoppingBag size={36} className="text-gray-300 mb-3" />
        <p className="text-gray-500 font-bold bengali">এই ক্যাটালগটি খুঁজে পাওয়া যায়নি বা এখনো পাবলিশ করা হয়নি।</p>
      </div>
    )
  }

  const theme = settings.theme_color || '#7c3aed'

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="text-white pt-10 pb-14 px-4 text-center" style={{ backgroundColor: theme }}>
        <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-3 overflow-hidden">
          {settings.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logo_url} alt={settings.store_name} className="w-full h-full object-cover" />
          ) : (
            <Store size={26} />
          )}
        </div>
        <h1 className="text-xl font-extrabold bengali">{settings.store_name}</h1>
        {settings.tagline && <p className="text-white/80 text-sm bengali mt-1">{settings.tagline}</p>}
        {settings.whatsapp_number && (
          <button onClick={() => orderOnWhatsApp()}
            className="mt-5 inline-flex items-center gap-2 bg-white px-5 py-2.5 rounded-xl text-sm font-bold bengali shadow-lg"
            style={{ color: theme }}>
            <MessageCircle size={16} /> হোয়াটসঅ্যাপে যোগাযোগ করুন
          </button>
        )}
      </div>

      {/* Products */}
      <div className="max-w-5xl mx-auto px-4 -mt-8">
        {products.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <p className="text-gray-400 text-sm bengali">এই মুহূর্তে কোনো প্রোডাক্ট নেই।</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="aspect-square bg-gray-50">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ShoppingBag size={26} />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400 bengali">{p.category}</div>
                  <div className="text-sm font-bold text-gray-800 bengali">{p.name}</div>
                  {p.description && <p className="text-[11px] text-gray-400 bengali line-clamp-2 mt-0.5">{p.description}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-extrabold text-sm" style={{ color: theme }}>₹{Number(p.price).toFixed(0)}</span>
                    {settings.whatsapp_number && (
                      <button onClick={() => orderOnWhatsApp(p)}
                        className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100">
                        <MessageCircle size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-center mt-10">
        <span className="text-[11px] text-gray-300 bengali">Powered by Sahayak AI</span>
      </div>
    </div>
  )
}
