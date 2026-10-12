// M7 shell sheet, adopted first in every widget's shadow root. No !important: the host can still hide or
// resize the element (`hidden`, `display:none`, `height: 560px`). The loading and error states are plain DOM.
export const SHELL_CSS = `
:host{display:block;position:relative;width:100%;aspect-ratio:16/9;min-height:320px}
:host([hidden]){display:none}
.plgrnd-shell{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;
  box-sizing:border-box;padding:16px;background:#171717;color:#a2a2a2;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-align:center}
.plgrnd-shell[data-theme=light]{background:#f4f4f5;color:#52525b}
.plgrnd-spinner{width:18px;height:18px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;
  animation:plgrnd-spin .8s linear infinite}
@keyframes plgrnd-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.plgrnd-spinner{animation:none}}
.plgrnd-wordmark{font-weight:700;letter-spacing:.2em}
.plgrnd-shell button{all:revert;cursor:pointer;font:inherit;color:inherit;background:transparent;
  border:1px solid currentColor;border-radius:6px;padding:4px 12px}
.plgrnd-shell a{color:inherit}
`

let shellSheet: CSSStyleSheet | null = null

export const supportsAdoptedSheets = (): boolean =>
  typeof CSSStyleSheet === 'function' &&
  'replaceSync' in CSSStyleSheet.prototype &&
  typeof ShadowRoot === 'function' &&
  'adoptedStyleSheets' in ShadowRoot.prototype

/** Adopts the realm-wide shell sheet (or inserts a <style> where constructable sheets are missing). */
export function adoptShellSheet(shadow: ShadowRoot): void {
  if (supportsAdoptedSheets()) {
    if (!shellSheet) {
      shellSheet = new CSSStyleSheet()
      shellSheet.replaceSync(SHELL_CSS)
    }
    shadow.adoptedStyleSheets = [shellSheet, ...shadow.adoptedStyleSheets.filter((s) => s !== shellSheet)]
    return
  }
  const style = document.createElement('style')
  style.textContent = SHELL_CSS
  shadow.prepend(style)
}
