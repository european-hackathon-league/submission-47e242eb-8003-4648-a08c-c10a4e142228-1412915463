// Branded replacement for the native <select> popup.
// The native element stays in the DOM as the source of truth: app code keeps reading
// select.value and listening for 'change'; this only draws the trigger and the list.

const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
const indexDescriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
let uid = 0;

// "BMW 5 Series · G60" → label "BMW 5 Series", meta "G60".
const splitText = text => {
  const parts = String(text).split(' · ');
  return parts.length > 1 ? { label: parts[0], meta: parts.slice(1).join(' · ') } : { label: text, meta: '' };
};

export function enhanceSelect(select) {
  if (!select || select.dataset.enhanced) return;
  select.dataset.enhanced = 'true';
  const id = `bmw-select-${++uid}`;
  const root = document.createElement('div');
  root.className = 'bmw-select';
  root.innerHTML = `<button type="button" class="bmw-select-trigger" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}-list"><span class="bmw-select-value"></span><svg class="bmw-select-chevron" viewBox="0 0 14 9" aria-hidden="true"><path d="M1 1l6 6 6-6"/></svg></button><ul class="bmw-select-list" id="${id}-list" role="listbox" tabindex="-1" hidden></ul>`;
  select.after(root);
  select.classList.add('bmw-select-native');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');
  const trigger = root.querySelector('.bmw-select-trigger'), list = root.querySelector('.bmw-select-list'), valueEl = root.querySelector('.bmw-select-value');
  const labelText = select.closest('label')?.childNodes[0]?.textContent?.trim();
  if (labelText) trigger.setAttribute('aria-label', labelText);
  let active = -1, typed = '', typedTimer;

  const options = () => [...select.options];
  const optionHtml = (option, index) => {
    const { label, meta } = splitText(option.textContent);
    const badge = option.dataset.badge ? `<span class="bmw-select-badge">${option.dataset.badge}</span>` : '';
    return `<li role="option" id="${id}-${index}" data-index="${index}" aria-selected="${option.selected}" class="${option.disabled ? 'disabled' : ''}"><span class="bmw-select-label">${escape(label)}${badge}</span>${meta ? `<span class="bmw-select-meta">${escape(meta)}</span>` : ''}</li>`;
  };
  const render = () => {
    const current = select.options[select.selectedIndex];
    if (current) {
      const { label, meta } = splitText(current.textContent);
      valueEl.innerHTML = `${escape(label)}${current.dataset.badge ? `<span class="bmw-select-badge">${current.dataset.badge}</span>` : ''}${meta ? `<span class="bmw-select-meta">${escape(meta)}</span>` : ''}`;
    } else valueEl.textContent = '';
    if (!list.hidden) renderList();
  };
  // The option list is only built while open, so pages with many dropdowns stay light.
  const renderList = () => { list.innerHTML = options().map(optionHtml).join(''); };
  const setActive = index => {
    const items = [...list.children];
    if (!items.length) return;
    active = Math.max(0, Math.min(items.length - 1, index));
    items.forEach((item, i) => item.classList.toggle('active', i === active));
    trigger.setAttribute('aria-activedescendant', items[active].id);
    items[active].scrollIntoView({ block: 'nearest' });
  };
  const open = () => {
    if (!list.hidden) return;
    renderList();
    list.hidden = false;
    root.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
    // Open upwards when there is not enough room below.
    const rect = trigger.getBoundingClientRect(), room = window.innerHeight - rect.bottom;
    root.classList.toggle('upward', room < Math.min(list.scrollHeight, 340) + 16 && rect.top > room);
    setActive(Math.max(0, select.selectedIndex));
    document.addEventListener('pointerdown', outside, true);
  };
  const close = (focus = true) => {
    if (list.hidden) return;
    list.hidden = true;
    list.innerHTML = '';
    root.classList.remove('open', 'upward');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant');
    document.removeEventListener('pointerdown', outside, true);
    if (focus) trigger.focus();
  };
  const outside = event => { if (!root.contains(event.target)) close(false); };
  const choose = index => {
    const option = select.options[index];
    if (!option || option.disabled) return;
    const changed = select.selectedIndex !== index;
    indexDescriptor.set.call(select, index);
    render();
    close();
    if (changed) select.dispatchEvent(new Event('change', { bubbles: true }));
  };

  trigger.addEventListener('click', () => (list.hidden ? open() : close()));
  list.addEventListener('pointerdown', event => event.preventDefault());
  list.addEventListener('click', event => { const item = event.target.closest('[role=option]'); if (item) choose(Number(item.dataset.index)); });
  list.addEventListener('pointermove', event => { const item = event.target.closest('[role=option]'); if (item && Number(item.dataset.index) !== active) setActive(Number(item.dataset.index)); });
  trigger.addEventListener('keydown', event => {
    const isOpen = !list.hidden, count = select.options.length;
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); if (!isOpen) return open(); setActive(active + (event.key === 'ArrowDown' ? 1 : -1)); }
    else if (event.key === 'Home' && isOpen) { event.preventDefault(); setActive(0); }
    else if (event.key === 'End' && isOpen) { event.preventDefault(); setActive(count - 1); }
    else if ((event.key === 'Enter' || event.key === ' ') && isOpen) { event.preventDefault(); choose(active); }
    else if (event.key === 'Escape' && isOpen) { event.preventDefault(); event.stopPropagation(); close(); }
    else if (event.key === 'Tab' && isOpen) close(false);
    else if (event.key.length === 1 && /\S/.test(event.key)) {
      clearTimeout(typedTimer); typed += event.key.toLowerCase(); typedTimer = setTimeout(() => { typed = ''; }, 600);
      const match = options().findIndex(option => option.textContent.toLowerCase().startsWith(typed));
      if (match >= 0) { if (isOpen) setActive(match); else choose(match); }
    }
  });
  select.addEventListener('focus', () => trigger.focus());
  select.addEventListener('change', render);
  // Keep the trigger in sync with programmatic changes and repopulated options.
  Object.defineProperty(select, 'value', { configurable: true, get() { return valueDescriptor.get.call(this); }, set(value) { valueDescriptor.set.call(this, value); render(); } });
  Object.defineProperty(select, 'selectedIndex', { configurable: true, get() { return indexDescriptor.get.call(this); }, set(value) { indexDescriptor.set.call(this, value); render(); } });
  new MutationObserver(render).observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['selected', 'disabled'] });
  render();
}

const escape = value => String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
