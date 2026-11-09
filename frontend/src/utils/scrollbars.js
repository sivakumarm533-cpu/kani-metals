/**
 * Scrollbars stay hidden until something scrolls. While an element (or the page)
 * is scrolling it gets `data-scrolling`, which styles/scrollbars.css uses to show
 * its thumb; the attribute is removed shortly after scrolling stops.
 */
const HIDE_AFTER_MS = 900
const timers = new WeakMap()

function onScroll(event) {
  const target = event.target === document ? document.documentElement : event.target
  if (!(target instanceof Element)) return
  if (!target.hasAttribute('data-scrolling')) target.setAttribute('data-scrolling', '')
  window.clearTimeout(timers.get(target))
  timers.set(target, window.setTimeout(() => target.removeAttribute('data-scrolling'), HIDE_AFTER_MS))
}

export function autoHideScrollbars() {
  // Capture phase: scroll events do not bubble, so this sees every scrolling element.
  document.addEventListener('scroll', onScroll, { capture: true, passive: true })
}
