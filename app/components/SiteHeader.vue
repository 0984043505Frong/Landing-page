<script setup lang="ts">
import { site } from '~/data/site'

// Below 1024px the menu is a panel that the "menu" button opens under the header.
// From 1024px the whole menu sits in the header row and there is no button (D-012).
const { isOpen, toggle, close } = useMobileMenu()
const menuButton = useTemplateRef<HTMLButtonElement>('menuButton')

// Escape closes the open menu and puts the focus back on the menu button.
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !isOpen.value) return
  close()
  menuButton.value?.focus()
}

// The open panel closes when the focus moves to an element outside the header, e.g. on Tab
// after the panel's last button: that element is on the page under the backdrop (D-018).
// The focus is not moved here; it goes on to that element as usual. The panel stays open
// while the focus stays in the header (the logo link, the menu button, the panel), and when
// the focus goes to no element at all (`relatedTarget` is null), e.g. after a tap on an empty
// part of the panel or a switch to another window.
function onFocusOut(event: FocusEvent) {
  const header = event.currentTarget as HTMLElement
  const nextFocus = event.relatedTarget
  if (isOpen.value && nextFocus instanceof Node && !header.contains(nextFocus)) close()
}

// Close the panel when the window gets wide enough for the full menu.
// 64rem is Tailwind's `lg` breakpoint (1024px), the one the template uses.
let desktopQuery: MediaQueryList | undefined

function onDesktopQueryChange(event: MediaQueryListEvent) {
  if (event.matches) close()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  desktopQuery = window.matchMedia('(min-width: 64rem)')
  desktopQuery.addEventListener('change', onDesktopQueryChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  desktopQuery?.removeEventListener('change', onDesktopQueryChange)
  close()
})
</script>

<template>
  <!-- site-header: gets a shadow once the page has scrolled (design spec 10.8, assets/css/motion.css). -->
  <header
    id="site-header"
    class="site-header sticky top-0 z-50 border-b border-border bg-surface"
    @focusout="onFocusOut"
  >
    <div class="page-container flex h-16 items-center justify-between gap-4">
      <!-- Named by its visible text, "BrightPath Academy", so it has no aria-label (D-010). -->
      <a
        href="#hero"
        class="inline-flex min-h-11 items-center gap-2.5 text-brand-900"
      >
        <BrandLogo />
      </a>

      <!-- The name stays the same whether the menu is open or closed; aria-expanded tells which (D-010). -->
      <button
        ref="menuButton"
        type="button"
        class="-mr-2.5 inline-grid size-12 cursor-pointer place-items-center rounded-button text-brand-900 hover:bg-brand-50 active:bg-brand-100 lg:hidden"
        :aria-label="site.header.menuButtonLabel"
        :aria-expanded="isOpen"
        aria-controls="site-nav"
        @click="toggle"
      >
        <IconX
          v-if="isOpen"
          class="size-[26px]"
        />
        <IconMenu
          v-else
          class="size-[26px]"
        />
      </button>

      <nav
        id="site-nav"
        class="lg:static lg:flex lg:max-h-none lg:items-center lg:gap-7 lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"
        :class="isOpen
          ? 'fixed inset-x-0 top-16 z-49 max-h-[calc(100dvh-64px)] overflow-y-auto border-b border-border bg-surface px-5 pt-1 pb-6 shadow-card md:px-8'
          : 'hidden'"
        :aria-label="site.header.navLabel"
      >
        <ul
          role="list"
          class="lg:flex lg:gap-6"
        >
          <li
            v-for="link in site.nav"
            :key="link.href"
          >
            <a
              :href="link.href"
              class="flex min-h-14 items-center justify-between gap-4 border-b border-border text-[18px] whitespace-nowrap text-ink hover:text-brand-700 active:bg-brand-50 lg:min-h-11 lg:border-0 lg:text-[16px] lg:decoration-2 lg:underline-offset-6 lg:hover:underline lg:active:bg-transparent"
              @click="close"
            >
              {{ link.label }}
              <IconChevronRight class="size-5 shrink-0 text-ink-muted lg:hidden" />
            </a>
          </li>
        </ul>
        <BaseButton
          :href="site.hero.primaryCta.href"
          class="mt-5 w-full lg:mt-0 lg:min-h-11 lg:w-auto lg:px-5 lg:py-2 lg:text-[16px]"
          @click="close"
        >
          {{ site.hero.primaryCta.label }}
        </BaseButton>
      </nav>
    </div>
  </header>

  <!-- Dims the page under the open mobile menu. A click on it closes the menu. -->
  <div
    v-if="isOpen"
    class="fixed inset-x-0 top-16 bottom-0 z-48 bg-brand-900/55 lg:hidden"
    aria-hidden="true"
    @click="close"
  />
</template>
