'use client'

/**
 * Syllabi: ask it anything, get a draft marked, or get ideas, with the three
 * a tab apart. ?tab=draft or ?tab=ideas opens straight on one. An idea can be
 * picked up and talked through, which opens Ask with the question written.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile, getSyllabus } from '@/lib/cache'
import DashboardLayout from '@/components/DashboardLayout'
import LockedPanel from '@/components/LockedPanel'
import SyllabiMark from '@/components/SyllabiMark'
import { Page, PageLoading } from '@/components/PageShell'
import TutorChat from '@/components/syllabi/TutorChat'
import IdeasStudio from '@/components/syllabi/IdeasStudio'
import DraftStudio from '@/components/syllabi/DraftStudio'
import ChatHistory from '@/components/syllabi/ChatHistory'
import { hasSyllabi } from '@/lib/access'
import { buildEffectiveProgressMap } from '@/lib/decay'
import { progressKey, STATUS_ORDER } from '@/lib/progress'

/**
 * Ask fills the screen so the box sits at the bottom of it; Ideas scrolls
 * like any page. The bottom room on narrower screens is for the floating
 * feedback button. Defined out here so the chat is not remounted on render.
 */
function Shell({ full, children }) {
  return full ? (
    <div className="app-enter mx-auto flex h-[calc(100dvh-56px)] w-full max-w-7xl flex-col px-4 pb-4 pt-4 md:h-dvh md:px-8 md:pb-5 md:pt-6">{children}</div>
  ) : (
    <Page width="wide">{children}</Page>
  )
}

/** The chat open in this tab, so a refresh carries on with it. */
const OPEN = 'psyllabus:tutor:open'
const remember = (id) => {
  try {
    if (id) sessionStorage.setItem(OPEN, id)
    else sessionStorage.removeItem(OPEN)
  } catch {
    /* it just will not reopen after a refresh */
  }
}

const TABS = [
  ['ask', 'Ask'],
  ['draft', 'Draft feedback'],
  ['ideas', 'Ideas'],
]

function Syllabi() {
  const params = useSearchParams()
  const [profile, setProfile] = useState(null)
  const [rows, setRows] = useState([])
  const [progressRows, setProgressRows] = useState([])
  const [tab, setTab] = useState(() => (TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'ask'))
  const [seed, setSeed] = useState({ n: 0, subject: '', text: '' })
  const [chats, setChats] = useState([])
  const [folders, setFolders] = useState([])
  const [chatsLoading, setChatsLoading] = useState(true)
  const [open, setOpen] = useState({ n: 0, chat: null })
  const [historyOpen, setHistoryOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser(supabase)
      if (!user) {
        router.push('/login')
        return
      }
      const p = await getProfile(supabase, user.id, { onFresh: setProfile })
      if (!p) {
        router.push('/onboarding')
        return
      }
      const [syllabus, { data: list }, { data: folderRows }] = await Promise.all([
        getSyllabus(supabase, p.subjects || []),
        supabase.from('syllabi_chats').select('id, subject, title, source, updated_at, folder_id').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(200),
        supabase.from('syllabi_folders').select('id, name, created_at').eq('user_id', user.id).order('created_at'),
      ])
      setRows(syllabus || [])
      // Where they stand in each subject, for the orbit; it can arrive after the page.
      supabase
        .from('progress')
        .select('*')
        .eq('user_id', user.id)
        .then(({ data }) => setProgressRows(data || []))
      setChats(list || [])
      setFolders(folderRows || [])
      // Carry on with the chat that was open before a refresh.
      let openId = null
      try {
        openId = sessionStorage.getItem(OPEN)
      } catch {
        /* none */
      }
      if (openId && (list || []).some((c) => c.id === openId)) {
        const { data } = await supabase.from('syllabi_chats').select('id, subject, messages').eq('id', openId).maybeSingle()
        if (data) setOpen({ n: 1, chat: data })
      }
      setChatsLoading(false)
      setProfile(p)
    }
    load()
  }, [router, supabase])

  // Leaving Syllabi forgets the open chat, so coming back starts on a new
  // one; a refresh never runs this, so it still carries on where it was.
  useEffect(() => () => remember(null), [])

  // Topics in syllabus order, for the topic picker.
  const topicsBySubject = useMemo(() => {
    const out = {}
    for (const r of [...rows].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))) {
      if (!out[r.subject]) out[r.subject] = []
      if (!out[r.subject].includes(r.topic)) out[r.subject].push(r.topic)
    }
    return out
  }, [rows])

  /* Where the student stands in each subject, for the orbit: how many
     subtopics are proved (proficient or better), and one status for the
     whole subject, the middle of the subtopics they have been tested on. */
  const standing = useMemo(() => {
    const effective = buildEffectiveProgressMap(progressRows)
    const out = {}
    for (const r of rows) {
      const e = (out[r.subject] ||= { total: 0, proved: 0, tested: [] })
      e.total++
      const st = effective[progressKey(r.subject, r.subtopic)] || 'not_started'
      if (st === 'proficient' || st === 'mastered') e.proved++
      if (st !== 'not_started') e.tested.push(st)
    }
    for (const e of Object.values(out)) {
      const fading = e.tested.filter((x) => x === 'decaying').length
      const ladder = e.tested.filter((x) => x !== 'decaying').map((x) => STATUS_ORDER.indexOf(x)).sort((a, b) => a - b)
      e.status = !e.tested.length ? 'not_started' : fading * 3 > e.tested.length || !ladder.length ? 'decaying' : STATUS_ORDER[ladder[Math.floor(ladder.length / 2)]]
      delete e.tested
    }
    return out
  }, [rows, progressRows])

  const openChat = useCallback(
    async (c) => {
      setHistoryOpen(false)
      const { data } = await supabase.from('syllabi_chats').select('id, subject, messages').eq('id', c.id).maybeSingle()
      if (!data) return
      remember(data.id)
      setOpen((o) => ({ n: o.n + 1, chat: data }))
    },
    [supabase]
  )

  const newChat = useCallback(() => {
    setHistoryOpen(false)
    remember(null)
    setOpen((o) => ({ n: o.n + 1, chat: null }))
  }, [])

  const saved = useCallback((meta) => {
    remember(meta.id)
    // A chat keeps its folder as it is saved.
    setChats((list) => [{ ...meta, folder_id: list.find((c) => c.id === meta.id)?.folder_id ?? null }, ...list.filter((c) => c.id !== meta.id)])
  }, [])

  /* Folders: made, renamed and removed by the student; a chat moves between them. */
  const createFolder = useCallback(
    async (name) => {
      const { data, error } = await supabase.from('syllabi_folders').insert({ name }).select('id, name, created_at').single()
      if (error || !data) return null
      setFolders((f) => [...f, data])
      return data.id
    },
    [supabase]
  )
  const renameFolder = useCallback(
    async (folder, name) => {
      setFolders((f) => f.map((x) => (x.id === folder.id ? { ...x, name } : x)))
      const { error } = await supabase.from('syllabi_folders').update({ name }).eq('id', folder.id)
      if (error) setFolders((f) => f.map((x) => (x.id === folder.id ? folder : x)))
    },
    [supabase]
  )
  const deleteFolder = useCallback(
    async (folder) => {
      const { error } = await supabase.from('syllabi_folders').delete().eq('id', folder.id)
      if (error) return
      setFolders((f) => f.filter((x) => x.id !== folder.id))
      // Its chats stay; the database lets go of the folder for them.
      setChats((list) => list.map((c) => (c.folder_id === folder.id ? { ...c, folder_id: null } : c)))
    },
    [supabase]
  )
  const moveChat = useCallback(
    async (chat, folderId) => {
      setChats((list) => list.map((c) => (c.id === chat.id ? { ...c, folder_id: folderId } : c)))
      const { error } = await supabase.from('syllabi_chats').update({ folder_id: folderId }).eq('id', chat.id)
      if (error) setChats((list) => list.map((c) => (c.id === chat.id ? { ...c, folder_id: chat.folder_id } : c)))
    },
    [supabase]
  )

  const removeChat = useCallback(
    async (c) => {
      const { error } = await supabase.from('syllabi_chats').delete().eq('id', c.id)
      if (error) return
      setChats((list) => list.filter((x) => x.id !== c.id))
      if (open.chat?.id === c.id) newChat()
    },
    [supabase, open.chat, newChat]
  )

  if (!profile) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="Syllabi" variant="syllabi" />
      </DashboardLayout>
    )
  }

  const subjects = profile.subjects || []
  const allowed = hasSyllabi(profile)
  const tabStyle = (on) =>
    on ? { background: 'var(--surface)', color: 'var(--text)', boxShadow: '0 1px 3px rgb(0 0 0 / 0.12)' } : { color: 'var(--text-muted)' }

  return (
    <DashboardLayout profile={profile}>
      <Shell full={allowed && tab !== 'ideas'}>
        <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2.5 text-[22px] font-semibold tracking-[-0.025em]">
            {allowed && tab === 'ask' && (
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                aria-expanded={historyOpen}
                className="mr-1 flex h-9 items-center rounded-full border px-3 text-[12.5px] font-medium lg:hidden"
                style={{ borderColor: 'var(--border-strong)' }}
              >
                Chats
              </button>
            )}
            <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: 'var(--brand)', color: '#fff' }}>
              <SyllabiMark size={15} />
            </span>
            Syllabi
          </h1>
          {allowed && (
            <nav className="flex rounded-full p-1" style={{ background: 'var(--surface-sunken)' }} aria-label="Syllabi tools">
              {TABS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setTab(key)
                    // Kept in the address so a refresh stays on the same tool.
                    window.history.replaceState(null, '', key === 'ask' ? '/dashboard/syllabi' : `/dashboard/syllabi?tab=${key}`)
                  }}
                  aria-pressed={tab === key}
                  className="whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors"
                  style={tabStyle(tab === key)}
                >
                  {label}
                </button>
              ))}
            </nav>
          )}
        </div>

        {!allowed ? (
          <LockedPanel
            plan="Premium"
            title="A tutor for every subject"
            blurb="Ask Syllabi to explain a topic, read a photo of a question, set you practice and mark your answer, or mark your IA draft against the criteria."
          />
        ) : tab === 'ask' ? (
          <div className="relative flex min-h-0 flex-1 gap-5">
            {/* Saved chats: a column on a wide screen, a panel on a narrow one. */}
            {/* A line between the saved chats and the conversation. */}
            <aside className="hidden w-64 shrink-0 flex-col border-r pr-5 lg:flex" style={{ borderColor: 'var(--border)' }}>
              <ChatHistory chats={chats} folders={folders} activeId={open.chat?.id} loading={chatsLoading} onOpen={openChat} onNew={newChat} onDelete={removeChat} onMove={moveChat} onCreateFolder={createFolder} onRenameFolder={renameFolder} onDeleteFolder={deleteFolder} />
            </aside>
            {historyOpen && (
              <div className="pop-enter absolute inset-y-0 left-0 z-30 flex w-[min(20rem,85vw)] flex-col rounded-[18px] border p-3 shadow-2xl lg:hidden" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
                <ChatHistory chats={chats} folders={folders} activeId={open.chat?.id} loading={chatsLoading} onOpen={openChat} onNew={newChat} onDelete={removeChat} onMove={moveChat} onCreateFolder={createFolder} onRenameFolder={renameFolder} onDeleteFolder={deleteFolder} />
              </div>
            )}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <TutorChat
                key={`${seed.n}-${open.n}`}
                subjects={subjects}
                topicsFor={(s) => topicsBySubject[s] || []}
                chat={seed.n && !open.chat ? null : open.chat}
                onSaved={saved}
                onNew={newChat}
                initialSubject={seed.subject}
                initialInput={seed.text}
                standing={standing}
                you={profile.full_name || ''}
              />
            </div>
          </div>
        ) : tab === 'draft' ? (
          <DraftStudio subjects={subjects} />
        ) : (
          <IdeasStudio
            subjects={subjects}
            userId={profile.id}
            onTalk={({ subject, text }) => {
              remember(null)
              setOpen((o) => ({ n: o.n + 1, chat: null }))
              setSeed((s) => ({ n: s.n + 1, subject, text }))
              setTab('ask')
            }}
          />
        )}
      </Shell>
    </DashboardLayout>
  )
}

export default function SyllabiPage() {
  return (
    <Suspense fallback={null}>
      <Syllabi />
    </Suspense>
  )
}
