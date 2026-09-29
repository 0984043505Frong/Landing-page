// Page-level motion script (v1.1, design spec section 10, D-045, D-050), ported from
// Demo-story/Landing-page/design/LP-016/motion.html. app.vue writes this file into the generated HTML
// as an inline script element at the end of the body. Plain JavaScript, no import or export: nothing
// here is bundled. (It is written as it is into the HTML, so its comments hold no HTML tags.)
//
// One mechanism for the whole page: it reads attributes that are already in the generated HTML
// (data-reveal, data-countup-mode, details[name="faq"], .site-header) and writes only its own data
// attributes, so it never waits for the page's JavaScript (the _nuxt folder) or for a component to
// hydrate, and never changes what Vue rendered. The CSS that moves things is in
// app/assets/css/motion.css.
//
// When it starts (D-050): on the frame after the first contentful paint. Until then it only
// registers what it waits for - no layout or style read and no change to the page - so the first
// paint comes as early as without it. What it hides, pauses or marks "pending" at start is off
// screen at that moment, and nothing it changes moves layout.
//
// If it never runs, nothing is hidden: count-up mode A counts by itself after 1200ms (CSS), mode B
// keeps the final values. If it fails half way, release() shows everything and puts the numbers on
// their final values, so nothing stays hidden or at 0 (D-046).
(() => {
  if (!('IntersectionObserver' in window)) return
  const root = document.documentElement
  const stats = document.querySelector('[data-countup-mode]')
  let started = false

  // Error path: every element that waits for reveal is shown at once (no fade), and the count-up
  // stops on the final values ("done" turns the CSS count off in both modes). The error is still
  // reported in the console. An error before the start also cancels the start, so nothing is
  // hidden after it.
  function release(error) {
    started = true
    for (const element of document.querySelectorAll('[data-reveal-state="hidden"]')) {
      element.setAttribute('data-reveal-state', 'instant')
    }
    if (stats) stats.setAttribute('data-countup-state', 'done')
    console.error(error)
  }

  // Everything the script runs, now or later in a callback, goes through guard().
  function guard(run) {
    return (...args) => {
      try {
        return run(...args)
      }
      catch (error) {
        release(error)
      }
    }
  }

  function isOffScreen(rect) {
    return rect.top >= window.innerHeight || rect.bottom <= 0
  }

  // Calls back once, when at least half of the element is on screen. The ratio is checked because
  // an observer may also report a smaller overlap (isIntersecting alone is true for any overlap).
  function whenHalfOnScreen(element, callback) {
    const observer = new IntersectionObserver(guard((entries) => {
      if (!entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.5)) return
      observer.disconnect()
      callback()
    }), { threshold: 0.5 })
    observer.observe(element)
  }

  // 2. Count-up. The mode comes from data-countup-mode on #stats (D-049); the CSS reads the same
  // attribute.
  function startCountUp() {
    const card = stats && stats.querySelector('ul')
    if (!card) return
    const mode = stats.getAttribute('data-countup-mode')
    const rect = card.getBoundingClientRect()

    if (mode === 'scroll') {
      // Mode B: numbers on screen (even partly) or already scrolled past keep their final value
      // and never count in this load. Only numbers fully below the screen wait at 0 (not seen yet)
      // and count once scrolled to.
      if (rect.top < window.innerHeight) return
      stats.setAttribute('data-countup-state', 'pending')
      whenHalfOnScreen(card, () => {
        if (stats.getAttribute('data-countup-state') === 'pending') stats.setAttribute('data-countup-state', 'run')
      })
      return
    }
    if (mode !== 'load') return

    // Mode A: the CSS animation shows 0 during its fallback delay, so the first paint already shows
    // 0. The script starts after that paint: numbers on screen count now (the whole 1000ms),
    // numbers off screen stay at 0 and count once half of the stats card is on screen. A count that
    // has already begun (the CSS fallback ran first, e.g. on a very slow phone) or that release()
    // cancelled is never paused or restarted, so the number never goes back and never stops half
    // way.
    const counts = document.getAnimations().filter(animation => animation.animationName === 'countup')
    if (!counts.length) return
    const step = Number.parseFloat(getComputedStyle(root).getPropertyValue('--stagger-step')) || 0
    const notBegun = animation => animation.playState !== 'idle' && animation.playState !== 'finished'
      && (animation.currentTime || 0) <= animation.effect.getTiming().delay
    // The count starts at this moment, not at the start of the current frame: inside a frame
    // callback play() would date it from the frame time, and the layout read above can take a few
    // hundred ms on a slow phone - the visitor would miss that part of the count (L-070).
    const startCounts = () => {
      const now = performance.now()
      counts.forEach((animation, index) => {
        if (!notBegun(animation)) return
        animation.effect.updateTiming({ delay: index * step })
        animation.startTime = now
      })
    }
    if (isOffScreen(rect)) {
      counts.forEach((animation) => {
        if (notBegun(animation)) animation.pause()
      })
      whenHalfOnScreen(card, startCounts)
    }
    else {
      startCounts()
    }
  }

  // 1. Scroll reveal: hide only what is fully below the screen now, so nothing on screen ever
  // blinks (D-030 rule 4).
  function startReveal() {
    const waiting = [...document.querySelectorAll('[data-reveal]')]
      .filter(element => element.getBoundingClientRect().top >= window.innerHeight)
    if (!waiting.length) return
    // Elements that come into view in the same callback are one batch: they stagger 80ms apart in
    // reading order (top to bottom, then left to right), and the 4th and later all wait 240ms
    // (the limit is 300ms).
    const revealer = new IntersectionObserver(guard((entries) => {
      entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => Math.round(a.boundingClientRect.top - b.boundingClientRect.top) || a.boundingClientRect.left - b.boundingClientRect.left)
        .forEach((entry, index) => {
          entry.target.setAttribute('data-reveal-step', String(Math.min(index, 3)))
          entry.target.setAttribute('data-reveal-state', 'shown')
          revealer.unobserve(entry.target)
        })
    }), { rootMargin: '0px 0px -10% 0px' })
    for (const element of waiting) {
      element.setAttribute('data-reveal-state', 'hidden')
      revealer.observe(element)
    }
    // Keyboard focus (Tab, Shift+Tab, a link to #id) reaches a waiting element: show it at once,
    // with no fade, before the next frame (WCAG 2.4.7, 2.4.11).
    document.addEventListener('focusin', guard((event) => {
      const element = event.target instanceof Element && event.target.closest('[data-reveal-state="hidden"]')
      if (!element) return
      element.setAttribute('data-reveal-state', 'instant')
      revealer.unobserve(element)
    }))
  }

  // 4. FAQ: mark a question when a visitor opens it (a click also covers Enter and Space on its
  // summary), so only openings made by the visitor animate. Capture phase: the mark is there
  // before the details element toggles.
  function watchFaq() {
    document.addEventListener('click', guard((event) => {
      const summary = event.target instanceof Element && event.target.closest('details[name="faq"] > summary')
      if (summary) summary.parentElement.setAttribute('data-faq-motion', '')
    }), true)
  }

  // 5. Header shadow: on once the page is scrolled more than 8px. Runs with reduced motion too
  // (the shadow then shows without a fade). The sentinel is added after the first paint, so its
  // CSS keeps it out of the flow (position: absolute) - otherwise the page would move down 8px.
  function watchHeader() {
    const sentinel = document.createElement('div')
    sentinel.className = 'scroll-sentinel'
    sentinel.setAttribute('aria-hidden', 'true')
    document.body.prepend(sentinel)
    new IntersectionObserver(guard((entries) => {
      root.toggleAttribute('data-scrolled', !entries[entries.length - 1].isIntersecting)
    })).observe(sentinel)
  }

  // The start: count-up, reveal and FAQ, then the header shadow. What hides, pauses or waits comes
  // before any observe(), so an error there is always released (L-064). It runs once, whichever
  // wait below comes first.
  const start = guard(() => {
    if (started) return
    started = true
    // With reduced motion nothing moves: nothing is hidden and the numbers are final (the CSS
    // does not count).
    if (window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
      startCountUp()
      startReveal()
      watchFaq()
    }
    watchHeader()
  })

  // Two frames: the first one is painted before run() (used by the fallbacks).
  function afterNextPaint(run) {
    requestAnimationFrame(guard(() => requestAnimationFrame(run)))
  }

  // Wait for the first contentful paint, then start on the next frame (D-050). Nothing above has
  // read layout or changed the page. Two fallbacks, so a script that runs always starts:
  // (a) no paint timing, or its observer cannot be made: start once the first frame has been painted;
  // (b) the first contentful paint is never reported: start 1s after load (still after a painted
  //     frame, so a page that loaded in a background tab starts when it is shown). Normally the
  //     start above ran long before.
  guard(() => {
    let waitsForPaint = false
    try {
      if (window.PerformanceObserver && (PerformanceObserver.supportedEntryTypes || []).includes('paint')) {
        new PerformanceObserver(guard((entries, observer) => {
          if (!entries.getEntriesByName('first-contentful-paint').length) return
          observer.disconnect()
          requestAnimationFrame(start)
        })).observe({ type: 'paint', buffered: true })
        waitsForPaint = true
      }
    }
    catch {
      // The browser cannot observe paint: fallback (a).
      waitsForPaint = false
    }
    if (!waitsForPaint) afterNextPaint(start)
    window.addEventListener('load', guard(() => {
      setTimeout(guard(() => afterNextPaint(start)), 1000)
    }))
  })()
})()
