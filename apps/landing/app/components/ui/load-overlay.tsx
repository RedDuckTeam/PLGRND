'use client'
import { useEffect, useState } from 'react'

export const LoadOverlay = () => {
  const [showOverlay, setShowOverlay] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setShowOverlay(false), 500)
    return () => clearTimeout(t)
  }, [])

  return showOverlay ? <div className="fixed inset-0 z-50 bg-black" /> : null
}
