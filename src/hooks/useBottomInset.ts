import { useEffect, useRef } from 'react';

/** Reserve the actual height, including wrapped text and safe-area padding. */
export function useBottomInset(visible: boolean, key = 'cookie') {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    const property = `--${key}-banner-height`;
    if (!visible || !element) return;
    const update = () => document.documentElement.style.setProperty(property, `${element.getBoundingClientRect().height}px`);
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(element);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      document.documentElement.style.removeProperty(property);
    };
  }, [visible, key]);
  return ref;
}
