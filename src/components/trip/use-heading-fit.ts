import { useEffect, type RefObject } from "react";

const headings = "h1, h2, h3, h4, h5, h6, :is(h1,h2,h3,h4,h5,h6) .editor-text-safe, .editor-text-display, .editor-text-section-title, .editor-text-subtitle, .editor-text-label, .eyebrow";

function longestRenderedWord(element: HTMLElement) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let longest = 0;
  let node = walker.nextNode();
  while (node) {
    for (const match of (node.textContent ?? "").matchAll(/[^\t\n\r ]+/g)) {
      const start = match.index;
      range.setStart(node, start);
      range.setEnd(node, start + match[0].length);
      longest = Math.max(longest, range.getBoundingClientRect().width);
    }
    node = walker.nextNode();
  }
  return longest;
}

/** Fit whole words to their actual text column, in every landing view. */
export function useHeadingFit(rootRef: RefObject<HTMLDivElement | null>, formatting: unknown) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = 0;
    let disposed = false;
    const observed = new Set<Element>();
    const fit = () => {
      frame = 0;
      if (disposed) return;
      const targets = Array.from(root.querySelectorAll<HTMLElement>(headings));
      for (const target of targets) {
        target.classList.remove("landing-heading-fitted");
        target.style.removeProperty("--heading-fit-size");
      }
      for (const target of targets) {
        const parent = target.parentElement;
        if (!parent) continue;
        if (!observed.has(parent)) {
          observed.add(parent);
          resize.observe(parent);
        }
        const style = getComputedStyle(target);
        const parentStyle = getComputedStyle(parent);
        const available = style.display === "inline"
          ? parent.clientWidth - parseFloat(parentStyle.paddingLeft) - parseFloat(parentStyle.paddingRight)
          : target.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        if (available <= 0) continue;
        let size = parseFloat(style.fontSize);
        let longest = longestRenderedWord(target);
        for (let attempt = 0; longest > available && attempt < 4; attempt += 1) {
          size *= available / longest * 0.98;
          target.style.setProperty("--heading-fit-size", `${size}px`);
          target.classList.add("landing-heading-fitted");
          longest = longestRenderedWord(target);
        }
      }
    };
    const schedule = () => {
      if (!disposed && !frame) frame = requestAnimationFrame(fit);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(root);
    const mutations = new MutationObserver(schedule);
    mutations.observe(root, { subtree: true, childList: true, characterData: true });
    document.fonts.ready.then(schedule);
    document.fonts.addEventListener("loadingdone", schedule);
    schedule();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      document.fonts.removeEventListener("loadingdone", schedule);
    };
  }, [rootRef, formatting]);
}