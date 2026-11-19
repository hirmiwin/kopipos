/**
 * Keeps the programmatic accessibility state (aria-invalid + aria-describedby)
 * in sync with the browser's visual :user-invalid state, and announces errors
 * through one polite live region. Based on the modern-web-guidance
 * `accessible-error-announcement` and `validate-input-after-interaction` guides.
 */
function spokenText(node: HTMLElement): string {
  const copy = node.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('[aria-hidden="true"]').forEach((element) => element.remove());
  copy.querySelectorAll('[role="img"][aria-label]').forEach((element) => {
    element.replaceWith(`${element.getAttribute('aria-label')}: `);
  });
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
}

let initialized = false;
let syncAllFields: (() => void) | null = null;

function linkError(field: HTMLElement, shown: boolean) {
  const errorId = field.dataset.error;
  if (!errorId) return;
  const ids = (field.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter((id) => id && id !== errorId);
  if (shown) ids.push(errorId);
  if (ids.length) field.setAttribute('aria-describedby', ids.join(' '));
  else field.removeAttribute('aria-describedby');
}

export function initFormA11y() {
  if (initialized) {
    syncAllFields?.();
    return;
  }
  initialized = true;

  const announcer = document.createElement('div');
  announcer.setAttribute('aria-live', 'polite');
  announcer.setAttribute('aria-atomic', 'true');
  announcer.className = 'visually-hidden';
  document.body.append(announcer);

  let announceTimer = 0;
  const flagged = new WeakSet<Element>();
  const announced = new WeakSet<Element>();

  const announceError = (field: HTMLElement) => {
    const error = document.getElementById(field.dataset.error ?? '');
    if (!error) return;
    const labelElement =
      field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement
        ? field.labels?.[0]
        : undefined;
    const label = labelElement ? `${spokenText(labelElement)}: ` : '';
    window.clearTimeout(announceTimer);
    announcer.textContent = '';
    announceTimer = window.setTimeout(() => {
      announcer.textContent = label + spokenText(error);
    }, 500);
  };

  const sync = (target: EventTarget | null, announce = false) => {
    if (!(target instanceof HTMLElement)) return;
    if (!target.matches('input, select, textarea')) return;
    const invalid = target.matches(':user-invalid');
    if (invalid) {
      if (announce && !announced.has(target)) {
        announceError(target);
        announced.add(target);
      }
      target.setAttribute('aria-invalid', 'true');
      linkError(target, true);
      flagged.add(target);
    } else if (flagged.has(target) || target.getAttribute('aria-invalid') !== 'true') {
      target.setAttribute('aria-invalid', 'false');
      linkError(target, false);
      flagged.delete(target);
      announced.delete(target);
    }
  };

  syncAllFields = () => {
    document.querySelectorAll<HTMLElement>('input, select, textarea').forEach((field) => sync(field));
  };
  syncAllFields();
  document.addEventListener('blur', (event) => sync(event.target, true), true);
  document.addEventListener('input', (event) => {
    if ((event.target as HTMLElement)?.hasAttribute?.('aria-invalid')) sync(event.target);
  });
  document.addEventListener('change', (event) => sync(event.target, true), true);
  document.addEventListener(
    'invalid',
    (event) => {
      announced.add(event.target as Element);
      sync(event.target);
    },
    true,
  );
  document.addEventListener('reset', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    window.setTimeout(() => [...form.elements].forEach((field) => sync(field)));
  });
}
