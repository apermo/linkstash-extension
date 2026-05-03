import type { WriteResponse } from '../lib/messages';

export type ToastKind = 'success' | 'error';

/**
 * Renders a transient pill at the top of the page.
 *
 * Runs in the page's main world via `chrome.scripting.executeScript`,
 * so it must be self-contained: no imports, no closures over outer
 * scope, no external types at runtime. Chrome serialises the function
 * source and re-parses it inside the target tab.
 */
export const renderToast = (message: string, kind: 'success' | 'error'): void => {
  const ID = '__linkstash_toast__';
  document.getElementById(ID)?.remove();

  const el = document.createElement('div');
  el.id = ID;
  el.textContent = message;

  const bg = kind === 'error' ? '#b3261e' : '#1a1a1a';
  const accent = kind === 'error' ? '#ffcdd2' : '#a8e6c1';

  el.style.cssText = [
    'position:fixed',
    'top:18px',
    'left:50%',
    'transform:translateX(-50%) translateY(-32px)',
    `background:${bg}`,
    'color:#fff',
    'padding:10px 18px 10px 32px',
    'border-radius:999px',
    'font:500 13px/1.3 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'letter-spacing:0.01em',
    'box-shadow:0 8px 24px rgba(0,0,0,0.28),0 2px 6px rgba(0,0,0,0.15)',
    'z-index:2147483647',
    'opacity:0',
    'transition:opacity 220ms ease,transform 260ms cubic-bezier(0.2,0.7,0.3,1.2)',
    'pointer-events:none',
    'max-width:min(420px,calc(100vw - 32px))',
    'text-align:center',
    'white-space:pre-wrap',
  ].join(';');

  const dot = document.createElement('span');
  dot.style.cssText = [
    'position:absolute',
    'left:14px',
    'top:50%',
    'transform:translateY(-50%)',
    'width:8px',
    'height:8px',
    'border-radius:50%',
    `background:${accent}`,
  ].join(';');
  el.appendChild(dot);

  document.body.appendChild(el);
  void el.offsetWidth;
  el.style.opacity = '1';
  el.style.transform = 'translateX(-50%) translateY(0)';

  window.setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(-32px)';
    window.setTimeout(() => {
      el.remove();
    }, 280);
  }, 2600);
};

export const toastTextFor = (resp: WriteResponse): { text: string; kind: ToastKind } => {
  if (!resp.ok) {
    return { text: `LinkStash: ${resp.error.message}`, kind: 'error' };
  }
  if (resp.kind === 'create') {
    return {
      text: resp.result.existing ? 'Already in LinkStash' : 'Saved to LinkStash',
      kind: 'success',
    };
  }
  if (resp.kind === 'update') {
    return { text: 'Updated in LinkStash', kind: 'success' };
  }
  return { text: 'Removed from LinkStash', kind: 'success' };
};

const swallow = () => {
  /* injection failures (chrome://, file://, no host permission) are
     never user-visible and never fatal — the extension keeps working,
     the user just doesn't get a confirmation toast on unsupported
     pages. */
};

export const showToastIn = async (
  tabId: number,
  text: string,
  kind: ToastKind,
): Promise<void> => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: renderToast,
      args: [text, kind],
      world: 'MAIN',
    });
  } catch {
    swallow();
  }
};

export const showToastInActiveTab = async (text: string, kind: ToastKind): Promise<void> => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id != null) await showToastIn(tab.id, text, kind);
  } catch {
    swallow();
  }
};
