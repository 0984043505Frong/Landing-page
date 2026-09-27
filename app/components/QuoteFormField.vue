<script setup lang="ts">
import { quoteForm } from '~/data/quoteForm'
import type { ThaiText } from '~/types/content'
import type { QuoteField } from '~/types/quote'

/**
 * One field of the quote form (design spec 4.11): the label, the control passed in the slot,
 * and the error message under it. The slot receives `controlProps` to bind on the control:
 * its id, the error wiring for screen readers and its look.
 *
 *   <QuoteFormField v-slot="{ controlProps }" field="name" :label="..." :error="..." required>
 *     <input v-bind="controlProps" v-model="..." name="name">
 *   </QuoteFormField>
 */
const props = defineProps<{
  field: QuoteField
  label: string
  /** Adds the red * after the label. The control itself still needs the `required` attribute. */
  required?: boolean
  /** Message of the field's current error, or nothing while the field is valid. */
  error?: ThaiText
}>()

defineSlots<{
  default(props: { controlProps: Record<string, string | undefined> }): unknown
}>()

// Controls keep their size in both states: the error border is 1px thicker, the padding 1px thinner.
// Only colours change on hover, and the focus outline is final as soon as the control gets focus.
const baseClass = 'block min-h-12 w-full rounded-input text-[16px] leading-[1.5] text-ink placeholder:text-ink-muted focus:outline-3 focus:outline-offset-1 focus:outline-brand-700'
const validClass = 'border border-border-strong bg-surface px-3.5 py-2.5 hover:border-ink focus:border-brand-700'
const invalidClass = 'border-2 border-danger bg-danger-tint px-[13px] py-[9px]'

const controlId = computed(() => `f-${props.field}`)
const errorId = computed(() => `f-${props.field}-error`)

// aria-invalid and aria-describedby exist only while there is an error (D-003).
const controlProps = computed(() => ({
  'id': controlId.value,
  'class': `${baseClass} ${props.error ? invalidClass : validClass}`,
  'aria-invalid': props.error ? 'true' : undefined,
  'aria-describedby': props.error ? errorId.value : undefined,
}))
</script>

<template>
  <div class="grid content-start gap-1.5">
    <!-- Vue keeps the line break after the label text as one space before the marker. -->
    <label
      :for="controlId"
      class="text-[15px] leading-[1.5] font-bold text-ink"
    >
      {{ label }}
      <span
        v-if="required"
        class="text-danger"
        aria-hidden="true"
      >*</span>
      <span
        v-else
        class="font-normal text-ink-muted"
      >({{ quoteForm.optionalLabel }})</span>
    </label>
    <slot :control-props="controlProps" />
    <p
      v-if="error"
      :id="errorId"
      class="flex items-start gap-1.5 text-[15px] leading-[1.5] text-danger"
    >
      <IconCircleAlert class="mt-0.5 size-[18px] shrink-0" />
      <PhraseText :text="error" />
    </p>
  </div>
</template>
