// IDLs the user pasted for a program, remembered in this browser so the next IDL node or import finds them.
// Lowest-priority source and always shown as unverified; the self-hosted widget never uses it.
const PREFIX = 'plgrnd:idl:'
const MAX_ENTRIES = 20
const MAX_BYTES = 5 * 1024 * 1024

interface RememberedIdl {
  idlJson: string
  pastedAt: number
}

const storage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

const entries = (store: Storage) => {
  const keys: string[] = []
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i)
    if (key?.startsWith(PREFIX)) keys.push(key)
  }
  return keys.map((key) => {
    try {
      return { key, value: JSON.parse(store.getItem(key) ?? '') as RememberedIdl }
    } catch {
      return { key, value: { idlJson: '', pastedAt: 0 } }
    }
  })
}

export function rememberUserIdl(programId: string, idlJson: string, now = Date.now()) {
  const store = storage()
  if (!store || idlJson.length > MAX_BYTES) return
  try {
    store.setItem(PREFIX + programId, JSON.stringify({ idlJson, pastedAt: now } satisfies RememberedIdl))
    // Least recently pasted first out, by count and by total size.
    const all = entries(store).sort((a, b) => b.value.pastedAt - a.value.pastedAt)
    let total = 0
    all.forEach(({ key, value }, i) => {
      total += value.idlJson.length
      if (i >= MAX_ENTRIES || total > MAX_BYTES) store.removeItem(key)
    })
  } catch {
    // Storage full or blocked: remembering is a convenience only.
  }
}

export function loadUserIdl(programId: string): unknown | null {
  const store = storage()
  try {
    const raw = store?.getItem(PREFIX + programId)
    return raw ? JSON.parse((JSON.parse(raw) as RememberedIdl).idlJson) : null
  } catch {
    return null
  }
}
