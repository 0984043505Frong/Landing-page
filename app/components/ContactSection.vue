<script setup lang="ts">
import { contact, contactSection } from '~/data/contact'
import { joinPhrases } from '~/utils/phrases'
import { newTabAttributes } from '~/utils/links'

// Contact buttons (design spec 4.10). Only their colours fade, not the focus ring (see BaseButton).
// contact-link: lifts on hover (design spec 10.6, assets/css/motion.css).
const linkClass = 'contact-link flex min-h-16 items-center gap-3.5 rounded-button border border-border bg-surface px-4 py-2.5 text-ink transition-[background-color,border-color] duration-150 hover:border-brand-700 hover:bg-brand-50 active:bg-brand-100'
const iconCircleClass = 'grid size-10 shrink-0 place-items-center rounded-full'
const textClass = 'grid min-w-0 leading-[1.4]'
const labelClass = 'text-[14px] text-ink-muted'
// Phone numbers and email addresses never break across lines.
const valueClass = 'text-[16px] font-bold whitespace-nowrap text-brand-900'

const emailHref = `mailto:${contact.email}`
</script>

<template>
  <section
    id="contact"
    class="bg-surface-muted py-16 lg:py-24"
    aria-labelledby="contact-heading"
  >
    <!-- From 1024px: the contact details on the left, the quote form on the right (design spec 4.10, 4.11). -->
    <div class="page-container grid gap-10 lg:grid-cols-[5fr_7fr] lg:items-start lg:gap-16">
      <!-- data-reveal (here and on the form card): fades in when scrolled to, done by app/motion/page-motion.js (design spec 10.4). -->
      <div
        class="contact-info"
        data-reveal
      >
        <SectionHeader
          heading-id="contact-heading"
          :heading="contactSection.heading"
          :intro="contactSection.intro"
          class="mb-6"
        />

        <ul
          role="list"
          class="grid gap-3"
        >
          <li
            v-for="highlight in contactSection.highlights"
            :key="joinPhrases(highlight)"
            class="flex items-start gap-3"
          >
            <span
              class="grid size-7 shrink-0 place-items-center rounded-full bg-brand-900 text-accent-500"
              aria-hidden="true"
            >
              <IconCheck class="size-4 stroke-3" />
            </span>
            <PhraseText :text="highlight" />
          </li>
        </ul>

        <!-- 1 column on phones, LINE and phone side by side from 768px, 1 column again beside the form. -->
        <ul
          role="list"
          class="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-1"
        >
          <li>
            <!--
              The LINE button of this demo leads to the quote form, not to a LINE account (D-006).
              Its text is dark on white: white text on LINE green would be too faint to read.
            -->
            <a
              :href="contact.line.contactHref"
              v-bind="newTabAttributes(contact.line.contactHref)"
              :aria-label="contact.line.contactAriaLabel"
              :class="linkClass"
            >
              <span
                :class="iconCircleClass"
                class="bg-line-green text-white"
                aria-hidden="true"
              >
                <IconLine class="size-6" />
              </span>
              <span :class="textClass">
                <span :class="valueClass">{{ contact.line.label }}</span>
              </span>
            </a>
          </li>
          <li>
            <a
              :href="contact.phoneHref"
              v-bind="newTabAttributes(contact.phoneHref)"
              :class="linkClass"
            >
              <span
                :class="iconCircleClass"
                class="bg-brand-50 text-brand-700"
                aria-hidden="true"
              >
                <IconPhone class="size-5" />
              </span>
              <span :class="textClass">
                <span :class="labelClass">{{ contactSection.phoneLabel }}</span>
                <!-- Keeps label and value apart in the link's accessible name. -->
                {{ ' ' }}
                <span :class="valueClass">{{ contact.phoneDisplay }}</span>
              </span>
            </a>
          </li>
          <li class="md:col-span-2 lg:col-span-1">
            <a
              :href="emailHref"
              v-bind="newTabAttributes(emailHref)"
              :class="linkClass"
            >
              <span
                :class="iconCircleClass"
                class="bg-brand-50 text-brand-700"
                aria-hidden="true"
              >
                <IconMail class="size-5" />
              </span>
              <span :class="textClass">
                <span :class="labelClass">{{ contactSection.emailLabel }}</span>
                {{ ' ' }}
                <span :class="valueClass">{{ contact.email }}</span>
              </span>
            </a>
          </li>
        </ul>
      </div>

      <!--
        The LINE button above leads here (#quote-form). The anchor is on the card, not on the
        <form>: after a successful submit the form is hidden and the card shows the thank-you
        message instead, and a browser cannot scroll to a hidden element (D-019).
      -->
      <div
        id="quote-form"
        class="form-card rounded-card bg-surface px-5 py-6 shadow-card md:p-10"
        data-reveal
      >
        <QuoteForm />
      </div>
    </div>
  </section>
</template>
