// Host theme toggle: flips <html class="dark|light"> the way Mintlify and next-themes do.
;(function () {
  var button = document.getElementById('theme-toggle')
  if (!button) return
  button.addEventListener('click', function () {
    var own = window.__hostProbe
      ? window.__hostProbe.own
      : function (fn) {
          return fn()
        }
    own(function () {
      var root = document.documentElement
      var dark = root.classList.contains('dark')
      root.classList.toggle('dark', !dark)
      root.classList.toggle('light', dark)
    })
  })
})()
