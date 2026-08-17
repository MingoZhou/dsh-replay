/**
 * dsh-replay — browser half.
 *
 * Three registrations:
 *  - `conversation.view`: a "Replay" tab inside the open session's view;
 *  - `sidebar.footer.action`: a bottom-left sidebar button ("会话回放" /
 *    "Session Replay");
 *  - `shell.overlay`: the full-screen modal the button opens, with its own
 *    session picker (works without an open conversation).
 */
import React, { useSyncExternalStore } from 'react'
import { HttpReplayApi } from './api.js'
import { ReplayApp } from './components/ReplayApp.js'
import { ReplayModal } from './components/ReplayModal.js'
import { detectLang, makeT } from './i18n.js'
import { mascotImage } from './mascot-image.js'
// esbuild is configured with `loader: { '.css': 'text' }`
// eslint-disable-next-line import/no-unresolved
import cssText from './styles.css'

export const name = 'dsh-replay'

export const inject = ['slots']

interface SlotRegistryLike {
  inject: (key: string, callback: () => unknown) => void
  register: (options: Record<string, unknown>, component: unknown) => () => void
}

interface ClientContextLike {
  slots: SlotRegistryLike
  effect: (callback: () => () => void, label?: string) => void
}

const api = new HttpReplayApi()

/** Tiny shared open/closed store bridging the sidebar button and the overlay. */
function createOpenStore(): {
  isOpen: () => boolean
  set: (value: boolean) => void
  subscribe: (listener: () => void) => () => void
} {
  let open = false
  const listeners = new Set<() => void>()
  return {
    isOpen: () => open,
    set(value: boolean) {
      open = value
      for (const listener of listeners) listener()
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

const modalStore = createOpenStore()

/** Standard conversation-scope props the slot renderer passes down. */
function ReplayTab(props: { sessionId?: string }): React.ReactElement {
  return React.createElement(ReplayApp, { api, sessionId: props.sessionId })
}

/**
 * 16×16 icon matching the official sidebar footer style: the mascot avatar
 * when artwork is embedded, otherwise a monochrome rewind glyph in
 * currentColor (same treatment as the built-in settings gear).
 */
function SidebarIcon(): React.ReactElement {
  if (mascotImage !== undefined) {
    return React.createElement('img', {
      src: mascotImage,
      width: 16,
      height: 16,
      style: { borderRadius: '50%', objectFit: 'cover', display: 'block' },
      alt: '',
    })
  }
  return React.createElement(
    'svg',
    { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
    React.createElement('path', {
      d: 'M 8 1.7 A 6.3 6.3 0 1 1 2.3 5.3',
      stroke: 'currentColor',
      strokeWidth: 1.5,
      strokeLinecap: 'round',
      fill: 'none',
    }),
    React.createElement('path', { d: 'M 2.1 1.6 L 2.3 5.5 L 6.1 4.9 Z', fill: 'currentColor' }),
    React.createElement('path', { d: 'M 6.7 5.6 L 11 8 L 6.7 10.4 Z', fill: 'currentColor' }),
  )
}

function SidebarReplayButton(): React.ReactElement {
  const t = makeT(detectLang())
  return React.createElement(
    'button',
    {
      className: 'dshr-sidebar-btn',
      onClick: () => modalStore.set(true),
      title: t('btn.replay'),
    },
    React.createElement(SidebarIcon),
    React.createElement('span', null, t('btn.replay')),
  )
}

function ReplayOverlay(): React.ReactElement | null {
  const open = useSyncExternalStore(modalStore.subscribe, modalStore.isOpen, modalStore.isOpen)
  if (!open) return null
  const t = makeT(detectLang())
  return React.createElement(ReplayModal, {
    api,
    onClose: () => modalStore.set(false),
    closeLabel: t('modal.close'),
  })
}

export function apply(ctx: ClientContextLike): void {
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset['plugin'] = 'dsh-replay'
    style.textContent = cssText as unknown as string
    document.head.append(style)
    return () => style.remove()
  }, 'dsh-replay: styles')

  ctx.slots.inject('conversation.view', () =>
    ctx.slots.register(
      { name: 'conversation.view', id: 'replay', order: 60, label: 'Replay' },
      ReplayTab,
    ),
  )

  ctx.slots.inject('sidebar.footer.action', () =>
    ctx.slots.register(
      { name: 'sidebar.footer.action', id: 'replay', order: 40 },
      SidebarReplayButton,
    ),
  )

  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register({ name: 'shell.overlay', id: 'replay-modal', order: 50 }, ReplayOverlay),
  )
}
