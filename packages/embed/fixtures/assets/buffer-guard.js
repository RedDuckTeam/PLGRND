// plain.html?bufferGuard=1    the host owns window.Buffer (a sentinel); it must be the same object after the widget runs.
// plain.html?bufferGuard=trap window.Buffer is an accessor that counts reads and writes and returns undefined, so the
//                             widget works only if it neither writes nor needs the global (its Buffer is module-scoped).
;(function () {
  var mode = new URLSearchParams(location.search).get('bufferGuard')
  if (!mode) return
  var guard = (window.__bufferGuard = { mode: mode, reads: 0, writes: 0 })
  if (mode === '1') {
    var sentinel = function HostBuffer() {}
    window.Buffer = sentinel
    guard.intact = function () {
      return window.Buffer === sentinel
    }
  } else if (mode === 'trap') {
    Object.defineProperty(window, 'Buffer', {
      configurable: true,
      get: function () {
        guard.reads++
        return undefined
      },
      set: function () {
        guard.writes++
      },
    })
    guard.intact = function () {
      return guard.writes === 0
    }
  }
  // The guard's own globals are part of the host, not the widget.
  if (window.__hostProbe) window.__hostProbe.rebaseKeys()
})()
