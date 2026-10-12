import { createContext, useContext } from 'react'

export type DialogOutsideEvent = CustomEvent<{ originalEvent: PointerEvent | FocusEvent }>

export interface DialogMode {
  /** Radix modal machinery (focus trap, scroll lock, `aria-hidden` on siblings). The app and `/embed` keep it. */
  modal: boolean
  /** Non-modal only: runs before Radix dismisses on an outside pointer or focus event; `preventDefault()` keeps it open. */
  onInteractOutside?: (event: DialogOutsideEvent) => void
}

export const DialogModeContext = createContext<DialogMode>({ modal: true })

export const useDialogMode = (): DialogMode => useContext(DialogModeContext)
