// Page-level motion script (v1.1, design spec section 10, D-045), ported from
// Demo-story/Landing-page/design/LP-016/motion.html. app.vue writes this file into the generated HTML
// as an inline script element at the end of the body: it runs once, as soon as the page is parsed,
// and never waits for the page's JavaScript (the _nuxt folder) or for a component to hydrate. Plain
// JavaScript, no import or export: nothing here is bundled. (It is written as it is into the HTML, so
// its comments hold no HTML tags.)
//
// One mechanism for the whole page: it reads attributes that are already in the generated HTML
// (data-reveal, data-countup-mode, details[name="faq"], .site-header) and writes only its own data
// attributes, so it never changes what Vue rendered. The CSS that moves things is in
// app/assets/css/motion.css.
//
// If it never runs, nothing is hidden: count-up mode A counts by itself after 1200ms (CSS), mode B
// keeps the final values. If it fails half way, release() shows everything and puts the numbers on
// their final values, so nothing stays hidden or at 0 (D-046).
(() => {
  if (!('IntersectionObserver' in window)) return
  const root = document.documentElement
  const stats = document.querySelector('[data-countup-mode]')

  // Error path: every element that waits for reveal is shown at once (no fade), and the count-up
  // stops on the final values ("done" turns the CSS count off in both modes). The error is still
  // reported in the console.
  function release(error) {
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

    // Mode A: the CSS animation shows 0 during its fallback delay. Start it on the frame after the
    // first contentful paint, so the visitor always sees 0 first and then the whole 1000ms. If the
    // numbers are off screen, keep them at 0 and start once half of the stats card is on screen.
    // A count that the CSS fallback already started (the script ran late) is left alone, so the
    // number never goes back.
    const counts = document.getAnimations().filter(animation => animation.animationName === 'countup')
    if (!counts.length) return
    const step = Number.parseFloat(getComputedStyle(root).getPropertyValue('--stagger-step')) || 0
    const startCounts = () => {
      counts.forEach((animation, index) => {
        // idle: cancelled by release(); finished or past its delay: already counting, leave it alone.
        const timing = animation.effect.getTiming()
        if (animation.playState === 'idle' || animation.playState === 'finished' || (animation.currentTime || 0) > timing.delay) return
        animation.effect.updateTiming({ delay: index * step })
        animation.currentTime = 0
        animation.play()
      })
    }
    if (isOffScreen(rect)) {
      counts.forEach(animation => animation.pause())
      whenHalfOnScreen(card, startCounts)
    }
    else if (window.PerformanceObserver && (PerformanceObserver.supportedEntryTypes || []).includes('paint')) {
      new PerformanceObserver(guard((entries, observer) => {
        if (!entries.getEntriesByName('first-contentful-paint').length) return
        observer.disconnect()
        requestAnimationFrame(guard(startCounts))
      })).observe({ type: 'paint', buffered: true })
    }
    else {
      requestAnimationFrame(guard(() => requestAnimationFrame(guard(startCounts))))
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
  // (the shadow then shows without a fade).
  function watchHeader() {
    const sentinel = document.createElement('div')
    sentinel.className = 'scroll-sentinel'
    sentinel.setAttribute('aria-hidden', 'true')
    document.body.prepend(sentinel)
    new IntersectionObserver(guard((entries) => {
      root.toggleAttribute('data-scrolled', !entries[entries.length - 1].isIntersecting)
    })).observe(sentinel)
  }

  // The order matters: everything that hides, pauses or waits is set up before the header's
  // observer, so an error at any point is caught with something to release, never before it
  // (a test that makes observe() throw can then fail, L-064).
  guard(() => {
    // With reduced motion nothing moves: nothing is hidden and the numbers are final (the CSS
    // does not count).
    if (window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
      startCountUp()
      startReveal()
      watchFaq()
    }
    watchHeader()
  })()
})()
