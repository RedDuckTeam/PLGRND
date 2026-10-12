import { toast } from 'sonner'

export const copyText = async (text: string, message: string) => {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(message)
  } catch {
    toast.error('Failed to copy')
  }
}
