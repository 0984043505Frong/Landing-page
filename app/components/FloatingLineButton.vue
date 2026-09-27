<script setup lang="ts">
import { contact } from '~/data/contact'
import { newTabAttributes } from '~/utils/links'
</script>

<template>
  <!--
    Round LINE button in the bottom-right corner of phones (design spec 4.12). In this demo it
    leads to the contact section, not to a LINE account (D-006); its aria-label says so.
    - Shown below 768px only, and hidden while the mobile menu is open (the `menu-open` class
      on <html>, see useMobileMenu).
    - Focus ring: navy outline plus a white ring inside it, visible on white and on navy.
      Only the press animates, so the focus ring is final as soon as the button has focus.
  -->
  <a
    :href="contact.line.floatingHref"
    v-bind="newTabAttributes(contact.line.floatingHref)"
    :aria-label="contact.line.floatingAriaLabel"
    class="fixed right-4 bottom-[calc(16px+env(safe-area-inset-bottom))] z-40 grid size-14 place-items-center rounded-full border-2 border-line-green-700 bg-line-green text-white shadow-fab transition-[scale] duration-150 hover:ring-4 hover:ring-line-green/30 focus-visible:outline-brand-900 focus-visible:ring-2 focus-visible:ring-white motion-safe:active:scale-96 md:hidden in-[.menu-open]:hidden"
  >
    <IconLine class="size-[30px]" />
  </a>
</template>
