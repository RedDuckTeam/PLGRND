// Host keyboard behaviour typical of docs sites: "/" focuses search, single-letter shortcuts,
// and a document-level Escape handler (as host modals use). No globals besides __hostProbe.
;(function () {
  var probe = window.__hostProbe
  var record = probe ? probe.state : {}
  record.hostEscape = []
  record.hostShortcuts = []

  function isEditable(target) {
    return (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT')
    )
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      setTimeout(function () {
        record.hostEscape.push(event.defaultPrevented)
      })
      return
    }
    if (isEditable(event.target)) return
    if (event.key === '/') {
      event.preventDefault()
      record.hostShortcuts.push('/')
      document.getElementById('host-search').focus()
    } else if (event.key === 's' || event.key === 'n' || event.key === 'k') {
      record.hostShortcuts.push(event.key)
    }
  })
})()
