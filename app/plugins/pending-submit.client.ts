/**
 * Holds a form submit that comes before the form's component has hydrated.
 *
 * The contact section hydrates only when it comes into view (app.vue), and its JavaScript takes a
 * moment to arrive. A submit in that moment has no Vue handler yet: this listener stops it and marks
 * the form with `data-submit-pending`; QuoteForm submits it again as soon as it hydrates. A form
 * that has hydrated carries `data-hydrated` and is left alone.
 */
export default defineNuxtPlugin(() => {
  document.addEventListener('submit', (event) => {
    const form = event.target
    if (!(form instanceof HTMLFormElement) || form.hasAttribute('data-hydrated')) return
    event.preventDefault()
    form.setAttribute('data-submit-pending', '')
  }, { capture: true })
})
