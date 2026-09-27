<script setup lang="ts">
import { contact } from '~/data/contact'
import { site } from '~/data/site'
import { newTabAttributes } from '~/utils/links'

const emailHref = `mailto:${contact.email}`

// Footer links are 44px tall (N5); they are underlined on hover and never fade the focus ring.
const linkClass = 'inline-flex min-h-11 items-center gap-2 text-white hover:underline hover:underline-offset-4 active:text-brand-100'
</script>

<template>
  <!--
    `on-dark`: focus rings are orange on this navy background (main.css).
    Below 768px the bottom padding leaves room for the floating LINE button (16 + 56 + 32px),
    so it never covers the last line of text (design spec 4.12).
  -->
  <footer
    id="site-footer"
    class="on-dark bg-brand-900 pt-14 pb-[calc(104px+env(safe-area-inset-bottom))] text-[15px] text-brand-100 md:pb-10"
  >
    <div class="page-container">
      <!-- 1 column on phones; brand across 2 columns at 768px; 3 columns from 1024px (design spec 4.13). -->
      <div class="grid gap-8 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
        <div class="md:col-span-2 lg:col-span-1">
          <!-- Not a link here: the header's logo already leads to the top of the page. -->
          <div class="inline-flex items-center gap-2.5 text-white">
            <BrandLogo on-dark />
          </div>
          <p class="mt-4 max-w-[30em]">
            <PhraseText :text="site.footer.about" />
          </p>
        </div>

        <nav aria-labelledby="footer-nav-title">
          <p
            id="footer-nav-title"
            class="font-bold text-white"
          >
            {{ site.footer.navTitle }}
          </p>
          <ul
            role="list"
            class="mt-1 grid"
          >
            <li
              v-for="link in site.nav"
              :key="link.href"
            >
              <a
                :href="link.href"
                :class="linkClass"
              >{{ link.label }}</a>
            </li>
          </ul>
        </nav>

        <div>
          <p class="font-bold text-white">
            {{ site.footer.contactTitle }}
          </p>
          <ul
            role="list"
            class="mt-1 grid"
          >
            <li>
              <a
                :href="contact.phoneHref"
                v-bind="newTabAttributes(contact.phoneHref)"
                :class="linkClass"
              >
                <IconPhone class="size-[18px] shrink-0 text-accent-500" />
                <span class="whitespace-nowrap">{{ contact.phoneDisplay }}</span>
              </a>
            </li>
            <li>
              <a
                :href="emailHref"
                v-bind="newTabAttributes(emailHref)"
                :class="linkClass"
              >
                <IconMail class="size-[18px] shrink-0 text-accent-500" />
                <span class="whitespace-nowrap">{{ contact.email }}</span>
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div class="mt-10 grid gap-1 border-t border-brand-800 pt-5 text-[14px] md:flex md:justify-between md:gap-6">
        <p>{{ site.footer.copyright }}</p>
        <p>
          <PhraseText :text="site.footer.note" />
        </p>
      </div>
    </div>
  </footer>
</template>
