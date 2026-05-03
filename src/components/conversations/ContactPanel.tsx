import { useMemo } from 'react'
import { Tag, Phone, Mail, Calendar, Hash, MapPin, Sparkles, Brain, ChevronRight } from 'lucide-react'
import Avatar from '../ui/Avatar'
import Badge from '../ui/Badge'
import Skeleton from '../ui/Skeleton'
import EmptyState from '../ui/EmptyState'
import { formatPhone, parseTags, parseMetadata, timeAgo, initials as initialsOf } from '../../lib/format'
import type { Contact } from '../../lib/types'

// HHC-specific custom-field map. Mirrors what we pulled from GHL on 2026-05-03.
// Keys with leading underscore are noise (FB tracking) and get hidden.
const HHC_FIELD_MAP: Record<string, string> = {
  rGILiTuEv8diyprtL5We: 'Who is it for?',
  r6QFPaH5MRuu99j7zfil: 'Lead time zone',
  siVUKxvddDABy9iNfHsX: 'Age range',
  H5Ik77mw0H2AtHQ2qDQT: 'HHC inbound calls',
  FORMqkY7gvCEQ4es4Uww: 'HHC last engagement',
  Y8zjVnCfOZatlROSrqLp: 'Engagement score',
  '1kVJKojoYWvpZuf8E7cn': 'Medicare Advantage',
  B6dwCiQxPXcbTmMKje81: 'ADL independence',
  JOIXw5jToHLDPuRAXQ5K: 'Medicaid',
  R4rRw7I7ki6IpO1CzSvk: 'Knows hospital copay',
  dELdFYTJ0k22sTH27kLv: 'Memory loss diagnosis',
  ietgdCoVRnoOHUqfrmBf: 'In nursing/home care',
  NFSVdxNwKSfjUpPlTWKJ: 'Health conditions',
  QvtPAdp7LYtIyH2QewjU: 'Copay',
  zxMwvuuyKkB7zipfiqKx: 'Wants out-of-pocket reduced',
  KxLlhIKwa5RkLbK41DFJ: 'AI disposition',
  XFz4e70xPue7H5JiUOAE: 'AI call summary',
  eBKnzq7TCg9UxwzWo0p8: 'AI pipeline stage',
  ghKtXPdQofeRtoRZL0DG: 'AI last call outcome',
  xaAewWxtd0C07uDYMV3m: 'AI outcome',
}

const NOISE_KEYS = new Set(['EtrLCTR9Aedz7kV95Gi4', 'GpYDYruwtWYQFOKTISHA', 'LzbnK1qbYa6R52Z91Sf9', 'Qg7bwfOMa9Fc9xqd1DlN', 'VETetuuTIciDUFYJ4CcL', 'cQtUREeSZ43LuOExCTiV', 'e3RzvCRrMp3LsVBTrxka', 'jOlOHbnI4DLNar2GYtqO'])

export default function ContactPanel({ contact, loading }: { contact: Contact | null; loading: boolean }) {
  if (loading && !contact) {
    return (
      <div className="w-80 shrink-0 border-l border-slate-800/60 bg-slate-950/40 backdrop-blur p-5 space-y-4">
        <Skeleton height={48} width={48} rounded="rounded-full" />
        <Skeleton height={16} width="60%" />
        <Skeleton height={12} width="80%" />
        <Skeleton height={12} width="55%" />
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="w-80 shrink-0 border-l border-slate-800/60 bg-slate-950/40 backdrop-blur">
        <EmptyState icon={Sparkles} title="Pick a conversation" description="Lead profile will appear here." />
      </div>
    )
  }

  const tags = parseTags(contact.tags)
  const metadata = parseMetadata(contact.metadata)
  const { mappedRows, unknownRows } = useMemo(() => {
    const mapped: Array<{ label: string; value: string; key: string }> = []
    const unknown: Array<{ label: string; value: string; key: string }> = []
    for (const [k, v] of Object.entries(metadata)) {
      if (!v || NOISE_KEYS.has(k)) continue
      const value = String(v)
      if (HHC_FIELD_MAP[k]) {
        mapped.push({ label: HHC_FIELD_MAP[k], value, key: k })
      } else if (!k.startsWith('_')) {
        unknown.push({ label: k, value, key: k })
      }
    }
    return { mappedRows: mapped, unknownRows: unknown }
  }, [metadata])

  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || initialsOf(contact.first_name, contact.last_name)

  return (
    <aside className="w-80 shrink-0 border-l border-slate-800/60 bg-slate-950/40 backdrop-blur overflow-y-auto">
      {/* Identity */}
      <div className="p-5 border-b border-slate-800/60 text-center">
        <Avatar firstName={contact.first_name} lastName={contact.last_name} size="lg" className="!w-14 !h-14 !text-base mx-auto mb-3" />
        <div className="text-base font-semibold text-slate-100">{name}</div>
        <div className="text-xs text-slate-500 mt-0.5">{contact.lead_stage ?? 'unstaged'}</div>
        {typeof contact.lead_score === 'number' && (
          <div className="mt-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-slate-800 bg-slate-900/60">
            <Hash className="w-3 h-3 text-indigo-400" />
            <span className="text-[11px] text-slate-300">Score <strong className="text-slate-100">{contact.lead_score}</strong></span>
          </div>
        )}
      </div>

      {/* Quick facts */}
      <div className="p-5 space-y-2.5 border-b border-slate-800/60">
        {contact.phone && <Row icon={Phone} label="Phone" value={formatPhone(contact.phone)} />}
        {contact.email && <Row icon={Mail} label="Email" value={contact.email} />}
        {contact.last_inbound_at && <Row icon={Calendar} label="Last reply" value={timeAgo(contact.last_inbound_at)} />}
        {contact.last_outbound_at && <Row icon={Calendar} label="Last sent" value={timeAgo(contact.last_outbound_at)} />}
        <Row icon={Hash} label="Follow-ups" value={String(contact.follow_up_count ?? 0)} />
      </div>

      {/* What the AI reads — make it clear that tags + custom fields are
          part of every reply's context. The model literally has access to
          everything you see below via {{contact_full_context}} in the
          master prompt. */}
      <div className="px-5 pt-4 pb-2 border-b border-slate-800/60">
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 flex items-start gap-2.5">
          <Brain className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
          <div className="text-[11px] text-slate-300 leading-relaxed">
            The AI reads <strong className="text-violet-200">{tags.length} tags</strong> and{' '}
            <strong className="text-violet-200">{mappedRows.length + unknownRows.length} custom fields</strong> on every reply.
          </div>
        </div>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="p-5 space-y-2 border-b border-slate-800/60">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium flex items-center gap-1.5">
            <Tag className="w-3 h-3" /> Tags · {tags.length}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t, i) => {
              const isHhcWho = /hhc \| (self|spouse|both|other)/i.test(t)
              const isSuppression = /booked|sold|lost|disqualified|suppress|replied \| call/i.test(t)
              const tone = isHhcWho ? 'indigo' : isSuppression ? 'red' : 'neutral'
              return (
                <Badge key={i} tone={tone} className="!text-[10px]">
                  {t}
                </Badge>
              )
            })}
          </div>
        </div>
      )}

      {/* Mapped custom fields (resolved labels) */}
      {mappedRows.length > 0 && (
        <div className="p-5 space-y-2.5 border-b border-slate-800/60">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium flex items-center gap-1.5">
            <MapPin className="w-3 h-3" /> Custom fields · {mappedRows.length}
          </div>
          <div className="space-y-2">
            {mappedRows.map((r) => (
              <div key={r.key} className="text-xs">
                <div className="text-slate-500">{r.label}</div>
                <div className="text-slate-200 mt-0.5 break-words">{r.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unmapped fields — shown collapsed so you can see they exist (and
          the AI sees them) but with raw GHL IDs as labels. Add to
          HHC_FIELD_MAP to give them real names. */}
      {unknownRows.length > 0 && (
        <details className="p-5 space-y-2.5">
          <summary className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium flex items-center gap-1.5 cursor-pointer hover:text-slate-300 transition">
            <ChevronRight className="w-3 h-3 transition group-open:rotate-90" />
            Unmapped fields · {unknownRows.length}
          </summary>
          <div className="space-y-1.5 mt-2">
            {unknownRows.map((r) => (
              <div key={r.key} className="text-[11px]">
                <div className="text-slate-600 font-mono truncate" title={r.key}>{r.key}</div>
                <div className="text-slate-300 mt-0.5 break-words">{r.value}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </aside>
  )
}

function Row({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 text-xs">
      <Icon className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-slate-500 text-[10px] uppercase tracking-[0.16em]">{label}</div>
        <div className="text-slate-200 mt-0.5 truncate">{value}</div>
      </div>
    </div>
  )
}
