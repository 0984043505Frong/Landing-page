<script setup lang="ts">
import { courses } from '~/data/courses'
import { quoteForm } from '~/data/quoteForm'
import type { QuoteErrorMessages, ThaiText } from '~/types/content'
import type { QuoteErrors, QuoteField, QuoteRequest } from '~/types/quote'
import { joinPhrases } from '~/utils/phrases'
import { submitQuote } from '~/utils/submitQuote'
import { NOT_SURE_COURSE_ID, validateQuote } from '~/utils/validateQuote'

/**
 * The "request a quote" form (design spec 4.11, rules in D-003).
 *
 * - Nothing is checked while the visitor fills in the form. The first submit checks every
 *   field; from then on each field's error follows its value, so it goes away as soon as the
 *   visitor types a valid value, and leaving a field shows its current state.
 * - A submit with errors moves the focus to the first field with an error.
 * - A valid submit hides the form and shows the thank-you message, which takes the focus.
 *   Nothing leaves the browser yet (see app/utils/submitQuote.ts).
 *
 * Links to the form point at the card around this component (#quote-form in ContactSection),
 * which stays visible in both states (D-019).
 */

// The fields in the order they appear on the page.
const FIELD_ORDER: QuoteField[] = ['name', 'company', 'phone', 'course', 'message']

function emptyRequest(): QuoteRequest {
  return { name: '', company: '', phone: '', course: '', message: '' }
}

const values = reactive<QuoteRequest>(emptyRequest())
const hasSubmitted = ref(false)
const isSent = ref(false)

const errors = computed<QuoteErrors>(() => (hasSubmitted.value ? validateQuote(values) : {}))

const errorMessages: QuoteErrorMessages = quoteForm.errors

function errorMessage<Field extends QuoteField>(field: Field): ThaiText | undefined {
  const code = errors.value[field]
  return code === undefined ? undefined : errorMessages[field][code]
}

// Course names are lists of phrases; an <option> can only hold plain text.
const courseOptions = courses.map(course => ({ value: course.id, label: joinPhrases(course.title) }))

const form = useTemplateRef<HTMLFormElement>('form')
const thankYou = useTemplateRef<HTMLElement>('thankYou')

function focusField(field: QuoteField) {
  const control = form.value?.elements.namedItem(field)
  if (control instanceof HTMLElement) control.focus()
}

async function onSubmit() {
  hasSubmitted.value = true
  const firstInvalid = FIELD_ORDER.find(field => errors.value[field] !== undefined)
  // Let the error messages render first, so the focused field is already described by its error.
  await nextTick()
  if (firstInvalid) {
    focusField(firstInvalid)
    return
  }

  await submitQuote({ ...values })
  isSent.value = true
  await nextTick()
  thankYou.value?.focus()
}

// "Send another request" brings back an empty form, ready to type into.
async function startOver() {
  Object.assign(values, emptyRequest())
  hasSubmitted.value = false
  isSent.value = false
  await nextTick()
  focusField('name')
}

// The contact section hydrates when it comes into view (app.vue), so a visitor may type before this
// component runs. Take over what is already in the fields: on hydration Vue keeps typed text only in
// text inputs and textareas, and would empty the phone field and the course list.
onBeforeMount(() => {
  for (const field of FIELD_ORDER) {
    const control = document.getElementById(`f-${field}`)
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) {
      values[field] = control.value
    }
  }
})

// From here on Vue handles submits. A submit made before hydration was held by
// app/plugins/pending-submit.client.ts: run it now.
onMounted(() => {
  const element = form.value
  if (!element) return
  element.setAttribute('data-hydrated', '')
  if (element.hasAttribute('data-submit-pending')) {
    element.removeAttribute('data-submit-pending')
    onSubmit()
  }
})
</script>

<template>
  <!--
    method="dialog": a submit that Vue does not handle (before this component hydrates, or without
    JavaScript) does nothing, instead of a GET that reloads the page with the typed values in the URL.
    Change it together with TODO(formspree) in app/utils/submitQuote.ts, e.g. to method="post"
    action="<form URL>", so that the form also sends without JavaScript.
  -->
  <form
    ref="form"
    method="dialog"
    novalidate
    aria-labelledby="form-title"
    :hidden="isSent"
    @submit.prevent="onSubmit"
  >
    <h3
      id="form-title"
      class="text-[20px] leading-[1.4] font-bold text-brand-900"
    >
      <PhraseText :text="quoteForm.title" />
    </h3>
    <p class="mt-1 text-[15px] text-ink-muted">
      <PhraseText :text="quoteForm.requiredNote" />
    </p>

    <!-- 1 column on phones; from 768px 2 columns, with the message across both. -->
    <div class="mt-6 grid gap-5 md:grid-cols-2">
      <QuoteFormField
        v-slot="{ controlProps }"
        field="name"
        :label="quoteForm.fields.name.label"
        :error="errorMessage('name')"
        required
      >
        <input
          v-bind="controlProps"
          v-model="values.name"
          name="name"
          type="text"
          autocomplete="name"
          required
        >
      </QuoteFormField>

      <QuoteFormField
        v-slot="{ controlProps }"
        field="company"
        :label="quoteForm.fields.company.label"
        :error="errorMessage('company')"
        required
      >
        <input
          v-bind="controlProps"
          v-model="values.company"
          name="company"
          type="text"
          autocomplete="organization"
          required
        >
      </QuoteFormField>

      <QuoteFormField
        v-slot="{ controlProps }"
        field="phone"
        :label="quoteForm.fields.phone.label"
        :error="errorMessage('phone')"
        required
      >
        <input
          v-bind="controlProps"
          v-model="values.phone"
          name="phone"
          type="tel"
          inputmode="tel"
          autocomplete="tel"
          required
        >
      </QuoteFormField>

      <QuoteFormField
        v-slot="{ controlProps }"
        field="course"
        :label="quoteForm.fields.course.label"
        :error="errorMessage('course')"
        required
      >
        <div class="relative">
          <!-- The placeholder option shows in grey; the room on the right is for the arrow. -->
          <select
            v-bind="controlProps"
            v-model="values.course"
            name="course"
            autocomplete="off"
            required
            class="cursor-pointer appearance-none pr-11 invalid:text-ink-muted [&_option]:text-ink"
          >
            <option value="">
              {{ quoteForm.fields.course.placeholder }}
            </option>
            <option
              v-for="option in courseOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
            <option :value="NOT_SURE_COURSE_ID">
              {{ quoteForm.notSureCourseLabel }}
            </option>
          </select>
          <IconChevronDown class="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2 text-ink-muted" />
        </div>
      </QuoteFormField>

      <QuoteFormField
        v-slot="{ controlProps }"
        field="message"
        :label="quoteForm.fields.message.label"
        :error="errorMessage('message')"
        class="md:col-span-2"
      >
        <textarea
          v-bind="controlProps"
          v-model="values.message"
          name="message"
          rows="4"
          autocomplete="off"
          :placeholder="quoteForm.fields.message.placeholder"
          class="min-h-30 resize-y"
        />
      </QuoteFormField>
    </div>

    <!-- As wide as its text and on the left, so the floating LINE button never covers it (design spec 0.2). -->
    <div class="mt-8">
      <BaseButton
        type="submit"
        class="min-w-50"
      >
        {{ quoteForm.submitLabel }}
      </BaseButton>
    </div>
  </form>

  <div :hidden="!isSent">
    <!-- Takes the focus after a successful submit, so screen readers read the message (D-003). -->
    <div
      ref="thankYou"
      role="status"
      tabindex="-1"
      class="grid justify-items-start gap-3 rounded-input"
    >
      <span
        class="grid size-14 place-items-center rounded-full bg-success-tint text-success"
        aria-hidden="true"
      >
        <IconCircleCheck class="size-7" />
      </span>
      <p class="text-[18px] leading-[1.5] font-bold text-brand-900">
        <PhraseText :text="quoteForm.success.message" />
      </p>
      <p class="text-[14px] leading-[1.6] text-ink-muted">
        <PhraseText :text="quoteForm.success.note" />
      </p>
    </div>
    <BaseButton
      variant="outline"
      class="mt-6"
      @click="startOver"
    >
      {{ quoteForm.success.resetLabel }}
    </BaseButton>
  </div>
</template>
