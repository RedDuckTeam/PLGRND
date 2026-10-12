// AC-R7: content swaps the way docs routers do them (replace the outlet's children, no reload). The QA harness drives
// window.__spa: mount/unmount cycles, a removal while the runtime is still loading, and a second load of the script.
;(function () {
  var outlet = document.getElementById('outlet')
  var flows = { a: outlet.getAttribute('data-flow-a'), b: outlet.getAttribute('data-flow-b') }
  var own = window.__hostProbe
    ? window.__hostProbe.own
    : function (fn) {
        return fn()
      }

  function show(page) {
    return own(function () {
      if (!flows[page]) {
        outlet.replaceChildren()
        return null
      }
      var article = document.createElement('article')
      var heading = document.createElement('h2')
      heading.textContent = 'Page ' + page.toUpperCase()
      var widget = document.createElement('plgrnd-flow')
      widget.setAttribute('flow', flows[page])
      widget.style.height = '360px'
      article.append(heading, widget)
      outlet.replaceChildren(article)
      return widget
    })
  }

  function ready(widget) {
    return new Promise(function (resolve) {
      widget.addEventListener('plgrnd:ready', resolve, { once: true })
    })
  }

  window.__spa = {
    show: show,
    clear: function () {
      show('none')
    },
    // Mount page A or B, wait for the widget, then navigate to the empty page.
    cycle: function (page) {
      return ready(show(page)).then(function () {
        show('none')
        return new Promise(function (resolve) {
          setTimeout(resolve, 50)
        })
      })
    },
    // Navigate away before the widget has finished loading.
    removeMidLoad: function () {
      show('a')
      show('none')
    },
    // A second classic <script> for the same file (two integrations on one page).
    loadScriptAgain: function () {
      return new Promise(function (resolve, reject) {
        var script = document.createElement('script')
        script.src = '/dist/plgrnd-flow.iife.js'
        script.onload = resolve
        script.onerror = reject
        own(function () {
          document.head.appendChild(script)
        })
      })
    },
  }

  document.getElementById('nav-a').addEventListener('click', function () {
    show('a')
  })
  document.getElementById('nav-b').addEventListener('click', function () {
    show('b')
  })
  document.getElementById('nav-none').addEventListener('click', function () {
    show('none')
  })
})()
