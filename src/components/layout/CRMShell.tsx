'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthScreen } from '@/components/auth/AuthScreen'
import { useAuth } from '@/hooks/useAuth'
import { useCRM } from '@/hooks/useCRM'
import { Sidebar, TopBar } from '@/components/layout/Sidebar'
import { Dashboard } from '@/views/Dashboard'
import { Leads } from '@/views/Leads'
import { Companies } from '@/views/Companies'
import { Contacts } from '@/views/Contacts'
import { Pipeline } from '@/views/Pipeline'
import { Prospecting } from '@/views/Prospecting'
import { Tasks } from '@/views/Tasks'
import {
  CompanyForm, ContactForm, DealForm, LeadForm, TaskForm,
  GlobalSearch,
} from '@/components/modals'
import type { Page } from '@/components/layout/Sidebar'

type ModalType = 'company' | 'lead' | 'contact' | 'deal' | 'task' | null

const PAGE_LABELS: Record<Page, string> = {
  dashboard: 'Dashboard',
  leads: 'Leads',
  prospecting: 'Prospecting',
  companies: 'Companies',
  contacts: 'Contacts',
  pipeline: 'Pipeline',
  tasks: 'Tasks',
}

export function CRMShell({ page }: { page: Page }) {
  const router = useRouter()
  const auth = useAuth()
  const crm = useCRM(auth.profile)
  const [modal, setModal] = useState<ModalType>(null)
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch((v) => !v)
      }
      if (e.key === 'Escape') {
        setShowSearch(false)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const userName = useMemo(
    () => auth.profile?.full_name || auth.profile?.email || '',
    [auth.profile?.email, auth.profile?.full_name],
  )

  function goTo(nextPage: Page | string) {
    router.push(`/${nextPage}`)
  }

  if (auth.loading && !auth.profile) {
    return (
      <div className="flex items-center justify-center h-screen text-sm text-muted-foreground">
        Loading session...
      </div>
    )
  }

  if (!auth.profile) {
    return (
      <AuthScreen
        isSupabaseConfigured={auth.isSupabaseConfigured}
        error={auth.error}
        onSignIn={auth.signIn}
        onSignUp={auth.signUp}
      />
    )
  }

  if (!crm.ready) {
    return (
      <div className="flex items-center justify-center h-screen text-sm text-muted-foreground">
        Loading CRM...
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="relative">
        <Sidebar
          page={page}
          onNav={goTo}
          onSignOut={auth.signOut}
          role={auth.profile.role}
          userName={userName}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          title={PAGE_LABELS[page]}
          onSearch={() => setShowSearch(true)}
        />
        <main className="flex-1 overflow-auto p-6 lg:p-8 relative">
          {page === 'dashboard' && <Dashboard crm={crm} onNav={goTo} onNew={(t) => setModal(t as ModalType)} />}
          {page === 'leads' && <Leads crm={crm} onNew={(t) => setModal(t as ModalType)} />}
          {page === 'prospecting' && <Prospecting crm={crm} />}
          {page === 'companies' && <Companies crm={crm} onNew={(t) => setModal(t as ModalType)} />}
          {page === 'contacts' && <Contacts crm={crm} onNew={(t) => setModal(t as ModalType)} />}
          {page === 'pipeline' && <Pipeline crm={crm} onNew={(t) => setModal(t as ModalType)} />}
          {page === 'tasks' && <Tasks crm={crm} onNew={(t) => setModal(t as ModalType)} />}
        </main>
      </div>

      {modal === 'company' && (
        <CompanyForm onSave={(v) => crm.addCompany(v)} onClose={() => setModal(null)} />
      )}
      {modal === 'lead' && (
        <LeadForm onSave={(v) => crm.addLead(v)} onClose={() => setModal(null)} />
      )}
      {modal === 'contact' && (
        <ContactForm companies={crm.companies} onSave={(v) => crm.addContact(v)} onClose={() => setModal(null)} />
      )}
      {modal === 'deal' && (
        <DealForm companies={crm.companies} contacts={crm.contacts} onSave={(v) => crm.addDeal(v)} onClose={() => setModal(null)} />
      )}
      {modal === 'task' && (
        <TaskForm deals={crm.deals} contacts={crm.contacts} onSave={(v) => crm.addTask(v)} onClose={() => setModal(null)} />
      )}
      {showSearch && (
        <GlobalSearch crm={crm} onClose={() => setShowSearch(false)} onNav={goTo} />
      )}
    </div>
  )
}
