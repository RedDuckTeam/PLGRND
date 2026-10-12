// Host probe: loaded first, as an external classic script, by every fixture page.
// It records what the page observes from the outside of <plgrnd-flow> elements and exposes
// window.__hostProbe for the QA harness. The fixture's own DOM operations are wrapped in
// __hostProbe.own(fn) so they are not attributed to the widget.
;(function () {
  'use strict'
  if (window.__hostProbe) return

  var SENTINELS = ['body', 'h1', 'h2', 'h3', 'a', 'button', 'table', 'code']
  var SENTINEL_PROPS = [
    'color',
    'background-color',
    'font-family',
    'font-size',
    'line-height',
    'letter-spacing',
    'font-weight',
    'text-transform',
    'margin-top',
    'padding-top',
    'border-top-width',
    'display',
  ]
  var HOST_KEYS = ['/', 's', 'n', 'k']

  var state = {
    mutations: [],
    parseMutations: 0,
    ownedMutations: 0,
    errors: [],
    rejections: [],
    cspViolations: [],
    keydowns: [],
    hostKeyHits: { '/': 0, s: 0, n: 0, k: 0 },
    timers: { created: 0, active: 0 },
  }

  function describeNode(node) {
    if (!node) return null
    if (node.nodeType === 1) {
      var el = node
      var id = el.id ? '#' + el.id : ''
      var cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : ''
      return el.tagName.toLowerCase() + id + cls
    }
    if (node.nodeType === 3) return '#text'
    return node.nodeName
  }

  // Parser insertions are not attributable: records delivered before DOMContentLoaded only count
  // into parseMutations. Effects of synchronous scripts during parsing are caught by comparing
  // snapshot() with the same page under ?widgets=0.
  var parsed = document.readyState !== 'loading'
  function record(records) {
    if (!parsed) {
      state.parseMutations += records.length
      return
    }
    for (var i = 0; i < records.length; i++) {
      var r = records[i]
      var entry = { type: r.type, target: describeNode(r.target) }
      if (r.type === 'attributes') {
        entry.attribute = r.attributeName
        entry.oldValue = r.oldValue
        entry.onWidget = r.target.nodeType === 1 && r.target.localName === 'plgrnd-flow'
      } else if (r.type === 'childList') {
        entry.added = Array.prototype.map.call(r.addedNodes, describeNode)
        entry.removed = Array.prototype.map.call(r.removedNodes, describeNode)
      }
      state.mutations.push(entry)
    }
  }

  var observer = new MutationObserver(record)
  observer.observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeOldValue: true,
    characterData: true,
  })

  document.addEventListener(
    'DOMContentLoaded',
    function () {
      state.parseMutations += observer.takeRecords().length
      parsed = true
    },
    { capture: true }
  )

  window.addEventListener('error', function (e) {
    state.errors.push(String((e && e.message) || e))
    state.errorTimes = state.errorTimes || []
    state.errorTimes.push(performance.now())
  })
  window.addEventListener('unhandledrejection', function (e) {
    var reason = e && e.reason
    state.rejections.push(String((reason && reason.message) || reason))
  })
  document.addEventListener('securitypolicyviolation', function (e) {
    state.cspViolations.push({ directive: e.violatedDirective, blocked: e.blockedURI, sample: e.sample })
  })

  // The widget's public ready event, as the host sees it.
  state.ready = []
  document.addEventListener('plgrnd:ready', function (e) {
    state.ready.push({
      id: e.target && e.target.id,
      t: performance.now(),
      bubbles: e.bubbles,
      composed: e.composed,
      version: e.detail && e.detail.version,
    })
  })

  document.addEventListener('keydown', function (e) {
    var entry = { key: e.key, code: e.code, target: describeNode(e.target), defaultPrevented: null }
    state.keydowns.push(entry)
    if (HOST_KEYS.indexOf(e.key) !== -1) state.hostKeyHits[e.key]++
    setTimeout(function () {
      entry.defaultPrevented = e.defaultPrevented
    })
  })

  // Net-active timer accounting (setTimeout / setInterval). Reassigning existing window
  // properties does not change the own-key set.
  var timerKinds = new Map()
  var nativeSetTimeout = window.setTimeout
  var nativeSetInterval = window.setInterval
  var nativeClearTimeout = window.clearTimeout
  var nativeClearInterval = window.clearInterval
  function settle(id) {
    if (timerKinds.has(id)) {
      timerKinds.delete(id)
      state.timers.active = timerKinds.size
    }
  }
  window.setTimeout = function (fn) {
    var args = Array.prototype.slice.call(arguments)
    var id
    if (typeof fn === 'function') {
      args[0] = function () {
        settle(id)
        return fn.apply(this, arguments)
      }
    }
    id = nativeSetTimeout.apply(window, args)
    timerKinds.set(id, 'timeout')
    state.timers.created++
    state.timers.active = timerKinds.size
    return id
  }
  window.setInterval = function () {
    var id = nativeSetInterval.apply(window, arguments)
    timerKinds.set(id, 'interval')
    state.timers.created++
    state.timers.active = timerKinds.size
    return id
  }
  window.clearTimeout = function (id) {
    settle(id)
    return nativeClearTimeout.call(window, id)
  }
  window.clearInterval = function (id) {
    settle(id)
    return nativeClearInterval.call(window, id)
  }

  var initialWindowKeys = []
  var initialDocumentKeys = []

  function attributesOf(el) {
    var out = {}
    for (var i = 0; i < el.attributes.length; i++) out[el.attributes[i].name] = el.attributes[i].value
    return out
  }

  function sheetText() {
    var parts = []
    var sheets = Array.prototype.slice.call(document.styleSheets).concat(document.adoptedStyleSheets || [])
    for (var i = 0; i < sheets.length; i++) {
      var rules
      try {
        rules = sheets[i].cssRules
      } catch {
        parts.push('[cross-origin sheet]')
        continue
      }
      for (var j = 0; j < rules.length; j++) parts.push(rules[j].cssText)
    }
    return parts.join('\n')
  }

  function sha256(text) {
    var data = new TextEncoder().encode(text)
    return crypto.subtle.digest('SHA-256', data).then(function (buf) {
      return Array.prototype.map
        .call(new Uint8Array(buf), function (b) {
          return ('0' + b.toString(16)).slice(-2)
        })
        .join('')
    })
  }

  function sentinelStyles() {
    var out = {}
    for (var i = 0; i < SENTINELS.length; i++) {
      var el = document.querySelector('[data-sentinel="' + SENTINELS[i] + '"]') || document.querySelector(SENTINELS[i])
      if (!el) {
        out[SENTINELS[i]] = null
        continue
      }
      var cs = getComputedStyle(el)
      var props = {}
      for (var j = 0; j < SENTINEL_PROPS.length; j++) props[SENTINEL_PROPS[j]] = cs.getPropertyValue(SENTINEL_PROPS[j])
      out[SENTINELS[i]] = props
    }
    return out
  }

  function storage(area) {
    var out = {}
    try {
      for (var i = 0; i < area.length; i++) {
        var key = area.key(i)
        out[key] = area.getItem(key)
      }
    } catch {
      return '[unavailable]'
    }
    return out
  }

  function diffKeys(initial, current) {
    var before = new Set(initial)
    var after = new Set(current)
    return {
      added: current.filter(function (k) {
        return !before.has(k)
      }),
      removed: initial.filter(function (k) {
        return !after.has(k)
      }),
    }
  }

  window.__hostProbe = {
    state: state,
    // Run a fixture-owned DOM operation; its mutation records are not attributed to the widget.
    own: function (fn) {
      record(observer.takeRecords())
      try {
        return fn()
      } finally {
        state.ownedMutations += observer.takeRecords().length
      }
    },
    // Re-capture the own-key baseline (call after the fixture's own scripts, before the widget loads).
    rebaseKeys: function () {
      initialWindowKeys = Object.getOwnPropertyNames(window)
      initialDocumentKeys = Object.getOwnPropertyNames(document)
    },
    snapshot: function () {
      record(observer.takeRecords())
      var css = sheetText()
      return sha256(css).then(function (hash) {
        return {
          cssHash: hash,
          sheetCount: document.styleSheets.length,
          adoptedSheetCount: (document.adoptedStyleSheets || []).length,
          html: {
            attributes: attributesOf(document.documentElement),
            style: document.documentElement.getAttribute('style'),
          },
          body: { attributes: attributesOf(document.body), style: document.body.getAttribute('style') },
          bodyChildren: Array.prototype.map.call(document.body.children, describeNode),
          sentinels: sentinelStyles(),
          localStorage: storage(window.localStorage),
          sessionStorage: storage(window.sessionStorage),
          cookie: document.cookie,
          windowKeys: diffKeys(initialWindowKeys, Object.getOwnPropertyNames(window)),
          documentKeys: diffKeys(initialDocumentKeys, Object.getOwnPropertyNames(document)),
          href: location.href,
          historyLength: history.length,
          mutations: state.mutations.length,
          errors: state.errors.length,
          rejections: state.rejections.length,
          cspViolations: state.cspViolations.length,
          activeTimers: state.timers.active,
        }
      })
    },
  }
  window.__hostProbe.rebaseKeys()
})()
