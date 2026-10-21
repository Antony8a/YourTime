import { useEffect } from 'react';
import { Platform } from 'react-native';

type InertElement = HTMLElement & { inert: boolean };

const MARK = 'data-yt-inert';

/**
 * On web, React Navigation keeps inactive tab scenes in the DOM, marked
 * aria-hidden but still focusable: pressing Tab walks into controls nobody can
 * see. Screen readers already skip them; this makes the keyboard skip them too,
 * by marking every aria-hidden layer `inert` and undoing it when the layer is
 * shown again. It only touches elements it marked itself. Native is unaffected.
 */
export function useInertWhenHidden(): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const sync = (el: Element) => {
      const node = el as InertElement;
      if (el.getAttribute('aria-hidden') === 'true') {
        if (!node.inert) {
          node.inert = true;
          el.setAttribute(MARK, '1');
        }
      } else if (el.hasAttribute(MARK)) {
        node.inert = false;
        el.removeAttribute(MARK);
      }
    };

    const syncAll = () => {
      document.querySelectorAll('[aria-hidden="true"]').forEach(sync);
      document.querySelectorAll(`[${MARK}]`).forEach(sync);
    };

    syncAll();
    const observer = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'attributes' && r.target instanceof Element) sync(r.target);
        else
          r.addedNodes.forEach(
            (n) =>
              n instanceof Element &&
              (sync(n), n.querySelectorAll('[aria-hidden="true"]').forEach(sync))
          );
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['aria-hidden'],
    });
    return () => observer.disconnect();
  }, []);
}
