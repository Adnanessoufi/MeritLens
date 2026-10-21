import {hungarianText} from '../shared/hu-copy.js'
import { useCallback, useEffect, useState } from 'react'

const warmPaths = new Set(['/config', '/assignments', '/submissions'])
const resources = new Map()
const freshResource = path => {
  const entry = resources.get(path)
  return entry && Date.now() - entry.updated < 15000 ? entry.data : null
}
export function prefetchResource(path, force = false) {
  if (!warmPaths.has(path)) return api(path)
  const entry = resources.get(path)
  if (entry?.pending) return entry.pending
  if (!force && freshResource(path) !== null) return Promise.resolve(entry.data)
  const next = { data: entry?.data ?? null, updated: entry?.updated ?? 0 }
  next.pending = api(path).then(data => {
    next.data = data; next.updated = Date.now(); next.pending = null
    return data
  }, error => { resources.delete(path); throw error })
  resources.set(path, next)
  return next.pending
}

export async function api(path, options = {}) {
  const { body, ...rest } = options
  let response
  try {
    response = await fetch(`/api${path}`, { ...rest,
      headers: body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
      body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('Could not reach Merit Lens. Check your connection and try again.')
  }
  if (response.ok && options.method && options.method !== 'GET') resources.clear()
  if (response.status === 204) return null
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(localStorage.getItem('merit-lens-language')==='hu'?hungarianText(data?.error || 'This request could not be completed. Please try again.'):data?.error || 'This request could not be completed. Please try again.')
  return data
}

export function useResource(path) {
  const [data, setData] = useState(() => freshResource(path))
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion(v => v + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    setError('')
    let active = true
    const request = warmPaths.has(path) ? prefetchResource(path, version > 0) : api(path, { signal: controller.signal })
    request.then(value => { if (active) setData(value) }).catch(error => {
      if (active && error.name !== 'AbortError') setError(error.message)
    })
    return () => { active = false; controller.abort() }
  }, [path, version])
  return { data, setData, error, reload }
}

export const navigate = path => { window.location.hash = path }
export function useRoute() {
  const [route, setRoute] = useState(window.location.hash.slice(1) || '/')
  useEffect(() => {
    const listener = () => { setRoute(window.location.hash.slice(1) || '/'); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', listener)
    return () => window.removeEventListener('hashchange', listener)
  }, [])
  return route
}
export const date = value => new Date(value).toLocaleDateString(document.documentElement.lang||undefined, { month: 'short', day: 'numeric' })
export const seconds = value => `${Math.round(value)}s`
