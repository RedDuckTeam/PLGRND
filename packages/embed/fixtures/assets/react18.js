/* global React, ReactDOM -- the vendored UMD builds loaded by react18.html */
// AC-R6 on React 18.3 (vendored UMD, no build step): React 18 passes every prop of a custom element as an attribute,
// so values are strings (`controls: '0'`); the buttons toggle theme and accent through React state.
;(function () {
  var h = React.createElement
  var container = document.getElementById('root')
  var flow = container.getAttribute('data-flow')

  function App() {
    var themeState = React.useState('dark')
    var accentState = React.useState('ed4937')
    var theme = themeState[0]
    var accent = accentState[0]
    return h(
      React.Fragment,
      null,
      h(
        'button',
        { id: 'toggle-theme', type: 'button', onClick: () => themeState[1](theme === 'dark' ? 'light' : 'dark') },
        'Toggle theme'
      ),
      h(
        'button',
        {
          id: 'toggle-accent',
          type: 'button',
          onClick: () => accentState[1](accent === 'ed4937' ? '2563eb' : 'ed4937'),
        },
        'Toggle accent'
      ),
      h('plgrnd-flow', {
        id: 'r18',
        flow: flow,
        theme: theme,
        accent: accent,
        controls: '0',
        'font-mono': 'monospace',
        style: { display: 'block', aspectRatio: '16/9', minHeight: 320 },
      })
    )
  }

  ReactDOM.createRoot(container).render(h(App))
})()
