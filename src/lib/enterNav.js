// Keyboard entry without the mouse: Enter in a field moves to the next field.
// On the last field of a dialog, form or [data-enter-scope] block, Enter presses its main button
// (the submit button, or the one marked data-enter-submit).

const FIELDS = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button.ag-sel';

const scopeOf = (el) => el.closest('[role=dialog], form, [data-enter-scope]') || el.closest('section, main') || document.body;
const visible = (el) => el.offsetParent !== null || el.getClientRects().length > 0;

export function focusNext(from) {
  const scope = scopeOf(from);
  const fields = [...scope.querySelectorAll(FIELDS)].filter(visible);
  const next = fields[fields.indexOf(from) + 1];
  if (next) {
    next.focus();
    if (next.tagName === 'INPUT' && /^(text|search|number|tel|email|)$/.test(next.type)) next.select?.();
    return true;
  }
  // Last field: press the block's main button, but only inside a dialog, a form or a marked block.
  if (!scope.matches('[role=dialog], form, [data-enter-scope]')) return false;
  const main = scope.querySelector('[data-enter-submit]:not([disabled])') || scope.querySelector('button[type=submit]:not([disabled])');
  if (main) { main.click(); return true; }
  return false;
}

export function onEnterKey(e) {
  if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.isComposing || e.defaultPrevented) return;
  const t = e.target;
  if (!(t instanceof HTMLElement) || t.closest('.ag-menu-float')) return;
  if (t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON') return;
  if (!t.matches(FIELDS)) return;
  e.preventDefault();
  focusNext(t);
}
