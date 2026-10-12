// Mimics Mintlify: every custom .js is appended as a classic async=false script after the page loads.
;(function () {
  function inject() {
    var own = window.__hostProbe
      ? window.__hostProbe.own
      : function (fn) {
          return fn()
        }
    if (window.__hostProbe) window.__hostProbe.state.injectedAt = performance.now()
    own(function () {
      var script = document.createElement('script')
      script.src = '/dist/plgrnd-flow.iife.js'
      script.async = false
      document.body.appendChild(script)
    })
  }
  if (document.readyState === 'complete') inject()
  else window.addEventListener('load', inject, { once: true })
})()
