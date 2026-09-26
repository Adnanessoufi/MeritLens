import { useCallback, useEffect, useState } from 'react'

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
  if (response.status === 204) return null
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error || 'This request could not be completed. Please try again.')
  return data
}

export function useResource(path) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion(v => v + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    setError('')
    api(path, { signal: controller.signal }).then(setData).catch(error => {
      if (error.name !== 'AbortError') setError(error.message)
    })
    return () => controller.abort()
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
export const date = value => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
export const seconds = value => `${Math.round(value)}s`
