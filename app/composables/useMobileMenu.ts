/**
 * Class on <html> while the mobile menu is open. main.css uses it to stop the page behind the
 * menu from scrolling, and other parts of the page can hide themselves with it, e.g. the
 * floating LINE button with the Tailwind class `in-[.menu-open]:hidden`.
 */
export const MENU_OPEN_CLASS = 'menu-open'

/**
 * Open/closed state of the mobile menu (below 1024px, D-012), shared by every component that
 * calls it: SiteHeader opens and closes the menu, and other components can read `isOpen`.
 */
export function useMobileMenu() {
  const isOpen = useState('mobile-menu-open', () => false)

  function setOpen(open: boolean) {
    isOpen.value = open
    // Updated right away, not on the next render: when a menu link is clicked, the page must
    // be scrollable again before the browser jumps to the link's section.
    document.documentElement.classList.toggle(MENU_OPEN_CLASS, open)
  }

  return {
    isOpen: readonly(isOpen),
    toggle: () => setOpen(!isOpen.value),
    close: () => setOpen(false),
  }
}
