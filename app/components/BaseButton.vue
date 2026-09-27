<script setup lang="ts">
/**
 * The site's button style (design spec 4.2). With `href` it renders a link that looks like a
 * button, otherwise a <button type="button"> (pass type="submit" to submit a form).
 */
type ButtonVariant = 'primary' | 'ghost-light'

withDefaults(defineProps<{
  href?: string
  /** 'primary' is the main call to action; 'ghost-light' is the secondary one on a navy background. */
  variant?: ButtonVariant
}>(), {
  href: undefined,
  variant: 'primary',
})

// Only the button's own colours fade (150ms), not the focus ring: Tailwind's ready-made class
// for fading colours also fades `outline-color`, so the ring would first show in the text colour.
const variantClasses: Record<ButtonVariant, string> = {
  'primary': 'border-transparent bg-accent-500 text-brand-900 hover:bg-accent-400 active:bg-accent-600',
  'ghost-light': 'border-white text-white hover:bg-white hover:text-brand-900 active:border-brand-100 active:bg-brand-100 active:text-brand-900',
}
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    :href="href"
    :type="href ? undefined : 'button'"
    class="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-button border-2 px-6 py-2.5 text-[17px] leading-[1.4] font-bold whitespace-nowrap transition-[color,background-color,border-color] duration-150"
    :class="variantClasses[variant]"
  >
    <slot />
  </component>
</template>
