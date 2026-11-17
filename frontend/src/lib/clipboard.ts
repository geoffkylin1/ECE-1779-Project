/**
 * Copy text to the clipboard. Returns false if the browser refused.
 *
 * navigator.clipboard only exists in secure contexts (https or localhost),
 * so fall back to the legacy execCommand('copy') when the app is served
 * over plain http (e.g. a VM's IP address during a demo).
 */
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Permission denied or not focused: try the fallback.
    }
  }
  return legacyCopy(text)
}

function legacyCopy(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    // Deprecated, but the only option outside secure contexts.
    return typeof document.execCommand === 'function' && document.execCommand('copy')
  } catch {
    return false
  } finally {
    textarea.remove()
  }
}
