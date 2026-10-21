'use client'

import { useEffect } from 'react'

export function PlgrndRegister() {
  useEffect(() => {
    void import('@plgrnd/embed')
  }, [])

  return null
}
