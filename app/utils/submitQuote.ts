import type { QuoteRequest } from '../types/quote'

/**
 * Sends a quote request that has passed `validateQuote()`.
 *
 * This demo site has no backend yet, so nothing leaves the browser: the form
 * validates and then shows its thank-you message.
 */
export async function submitQuote(request: QuoteRequest): Promise<void> {
  // TODO(formspree): send the request once a Formspree form exists, e.g.
  //   await fetch('https://formspree.io/f/<FORM_ID>', {
  //     method: 'POST',
  //     headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  //     body: JSON.stringify(request),
  //   })
  // Until then the form only validates and shows the thank-you message,
  // so `request` is intentionally unused.
  void request
}
