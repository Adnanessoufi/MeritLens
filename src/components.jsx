import React from 'react'

const paths = {
  arrow: <path d="M4 12h15M13 5l7 7-7 7" />,
  back: <path d="M20 12H5m6-7-7 7 7 7" />,
  mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M9 22h6" /></>,
  book: <path d="M12 5v15M3 4c4-1 6-1 9 1 3-2 5-2 9-1v15c-4-1-6-1-9 1-3-2-5-2-9-1Z" />,
  file: <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 13h8M8 17h5" />,
  upload: <path d="M12 16V3m-5 5 5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />,
  check: <path d="m5 12 4 4L19 6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  people: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a4 4 0 0 1 3 4v2" /></>,
  spark: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4M18 4h4" />,
  shield: <><path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z" /><path d="m8 12 3 3 5-6" /></>,
  volume: <path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8M18 4a11 11 0 0 1 0 16" />,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  keyboard: <><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 15h10" /></>,
  trash: <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />,
  edit: <path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15ZM4 20h16" />,
  link: <path d="m9 15 6-6M8 15l-2 2a3 3 0 0 1-4-4l5-5a3 3 0 0 1 4 0M16 9l2-2a3 3 0 0 0-4-4l-2 2M13 16l4-4a3 3 0 0 0 0-4" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  headphones: <><path d="M4 14v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="12" width="4" height="8" rx="2" /><rect x="17" y="12" width="4" height="8" rx="2" /></>,
}
export function Icon({ name, size = 20, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.spark}</svg>
}
export function Logo() {
  return <a className="logo" href="#/" aria-label="Merit Lens home"><span className="logo-symbol"><span /><span /></span>merit<span className="logo-light">lens</span><span className="logo-period">.</span></a>
}
export function Button({ children, variant = 'primary', className = '', loading, ...props }) {
  return <button className={`button button-${variant} ${className}`} {...props} disabled={props.disabled || loading}>{loading && <span className="spinner" />}{children}</button>
}
export function ErrorNotice({ message, onRetry }) {
  if (!message) return null
  return <div className="error-notice" role="alert"><span>{message}</span>{onRetry && <button onClick={onRetry}>Try again</button>}</div>
}
export function Loading({ label = 'Bringing things into focus…' }) { return <div className="loading-state" role="status"><span className="spinner" />{label}</div> }
export function Badge({ status, children }) {
  return <span className={`badge badge-${status?.toLowerCase() || 'neutral'}`}><i />{children || status?.toLowerCase()}</span>
}
export function Wave({ active = false, className = '' }) {
  return <div className={`wave ${active ? 'wave-active' : ''} ${className}`} aria-hidden="true">{[12, 21, 34, 47, 30, 57, 40, 25, 49, 64, 36, 52, 29, 41, 20, 12].map((height, i) => <span key={i} style={{ '--height': `${height}px`, '--delay': `${i * 75}ms` }} />)}</div>
}
export function Empty({ title, children, icon = 'file' }) { return <div className="empty-state"><span className="icon-tile"><Icon name={icon} size={26} /></span><h3>{title}</h3><p>{children}</p></div> }
