/* ==========================================================================
   Личные финансы — трекер доходов и расходов
   Vanilla JS. Сохранение в localStorage, полный пересчёт после изменений.
   ========================================================================== */

'use strict';

const STORAGE_KEY = 'expense-tracker.operations.v1';
const DEMO_FLAG_KEY = 'expense-tracker.demo.v1';

const INCOME_CATEGORIES = ['Зарплата', 'Фриланс', 'Инвестиции', 'Подарки', 'Прочее'];
const EXPENSE_CATEGORIES = [
  'Продукты',
  'Кафе и рестораны',
  'Транспорт',
  'Жильё и ЖКХ',
  'Связь и интернет',
  'Здоровье',
  'Развлечения',
  'Одежда',
  'Образование',
  'Путешествия',
  'Прочее',
];

/* ------------------------------ Состояние ------------------------------ */

let operations = loadOperations();
let filters = { period: 'month', type: 'all', category: 'all', search: '' };
let formType = 'expense';
let editingId = null;
let pendingDeleteId = null;
let pendingClearAll = false;
let demoMode = false;

/* ------------------------------ DOM-элементы ---------------------------- */

const els = {
  balance: document.getElementById('balance'),
  incomeTotal: document.getElementById('income-total'),
  expenseTotal: document.getElementById('expense-total'),
  operationsCount: document.getElementById('operations-count'),
  operationsList: document.getElementById('operations-list'),
  emptyState: document.getElementById('empty-state'),
  filteredEmpty: document.getElementById('filtered-empty'),
  addBtn: document.getElementById('add-btn'),
  emptyAddBtn: document.getElementById('empty-add-btn'),

  periodSelect: document.getElementById('period-select'),
  typeFilter: document.getElementById('type-filter'),
  categoryFilter: document.getElementById('category-filter'),
  searchInput: document.getElementById('search-input'),
  resetFiltersBtn: document.getElementById('reset-filters'),

  operationOverlay: document.getElementById('operation-overlay'),
  modalTitle: document.getElementById('modal-title'),
  form: document.getElementById('operation-form'),
  typeExpenseBtn: document.getElementById('type-expense'),
  typeIncomeBtn: document.getElementById('type-income'),
  amountInput: document.getElementById('amount'),
  dateInput: document.getElementById('date'),
  categorySelect: document.getElementById('category'),
  commentInput: document.getElementById('comment'),
  amountField: document.getElementById('amount-field'),
  dateField: document.getElementById('date-field'),
  categoryField: document.getElementById('category-field'),
  amountError: document.getElementById('amount-error'),
  dateError: document.getElementById('date-error'),
  categoryError: document.getElementById('category-error'),
  formCancelBtn: document.getElementById('form-cancel'),

  activeFilters: document.getElementById('active-filters'),

  demoBanner: document.getElementById('demo-banner'),
  demoClearBtn: document.getElementById('demo-clear'),
  demoDismissBtn: document.getElementById('demo-dismiss'),

  confirmOverlay: document.getElementById('confirm-overlay'),
  confirmTitle: document.getElementById('confirm-title'),
  confirmText: document.getElementById('confirm-text'),
  confirmCancelBtn: document.getElementById('confirm-cancel'),
  confirmDeleteBtn: document.getElementById('confirm-delete'),
};

/* ------------------------------- Хранилище ------------------------------ */

function loadOperations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(isValidOperation);
  } catch (err) {
    return [];
  }
}

function saveOperations() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(operations));
  } catch (err) {
    /* хранилище недоступно или переполнено */
  }
}

/* -------------------------- Демонстрационные данные --------------------- */

function saveDemoFlag() {
  try {
    if (demoMode) localStorage.setItem(DEMO_FLAG_KEY, '1');
    else localStorage.removeItem(DEMO_FLAG_KEY);
  } catch (err) {
    /* хранилище недоступно */
  }
}

function loadDemoFlag() {
  try {
    return localStorage.getItem(DEMO_FLAG_KEY) === '1';
  } catch (err) {
    return false;
  }
}

function setDemoMode(active) {
  demoMode = active;
  saveDemoFlag();
}

/* Набор демонстрационных операций: часть за текущий месяц, часть за прошлый.
   Даты подставляются относительно сегодняшнего дня, чтобы данные всегда
   выглядели актуальными. */
function buildDemoOperations() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const prev = new Date(year, month - 1, 1);
  const prevLastDay = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate();

  function iso(y, mIndex, day) {
    return y + '-' + pad(mIndex + 1) + '-' + pad(day);
  }
  function curDay(day) {
    return iso(year, month, Math.max(1, Math.min(day, now.getDate())));
  }
  function prevDay(day) {
    return iso(prev.getFullYear(), prev.getMonth(), Math.max(1, Math.min(day, prevLastDay)));
  }

  const base = Date.now();
  let n = 0;
  function make(type, amount, category, date, comment) {
    n += 1;
    return {
      id: 'op_demo_' + n.toString(36) + '_' + Math.random().toString(36).slice(2, 8),
      type: type,
      amount: amount,
      category: category,
      date: date,
      comment: comment,
      createdAt: base + n,
      updatedAt: base + n,
    };
  }

  return [
    // текущий месяц — доходы
    make('income', 85000, 'Зарплата', curDay(5), 'Зарплата за месяц'),
    make('income', 18500, 'Фриланс', curDay(9), 'Проект: лендинг'),
    make('income', 3200, 'Инвестиции', curDay(2), 'Дивиденды по акциям'),
    // текущий месяц — расходы
    make('expense', 12000, 'Жильё и ЖКХ', curDay(1), 'Аренда квартиры'),
    make('expense', 4350, 'Продукты', curDay(3), 'Продукты на неделю'),
    make('expense', 700, 'Связь и интернет', curDay(4), 'Мобильная связь и интернет'),
    make('expense', 1500, 'Транспорт', curDay(6), 'Проездной на месяц'),
    make('expense', 980, 'Кафе и рестораны', curDay(8), 'Ужин с друзьями'),
    make('expense', 2300, 'Здоровье', curDay(10), 'Витамины и анализы'),
    make('expense', 1200, 'Развлечения', curDay(11), 'Кино'),
    make('expense', 3700, 'Одежда', curDay(12), 'Куртка на осень'),
    // прошлый месяц
    make('income', 85000, 'Зарплата', prevDay(5), 'Зарплата за месяц'),
    make('expense', 12000, 'Жильё и ЖКХ', prevDay(1), 'Аренда квартиры'),
    make('expense', 22000, 'Путешествия', prevDay(14), 'Поездка на море'),
    make('expense', 5100, 'Продукты', prevDay(21), 'Продукты на неделю'),
  ];
}

/* Заполняет приложение демо-данными только при первом запуске:
   если хранилище ещё ни разу не инициализировалось. После того как
   пользователь добавит или удалит операции, повторного заполнения не будет. */
function maybeSeedDemoData() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    return;
  }
  if (raw !== null) return;

  operations = buildDemoOperations();
  setDemoMode(true);
  saveOperations();
}

function isValidOperation(op) {
  return (
    op &&
    typeof op.id === 'string' &&
    (op.type === 'income' || op.type === 'expense') &&
    typeof op.amount === 'number' &&
    Number.isFinite(op.amount) &&
    op.amount > 0 &&
    typeof op.category === 'string' &&
    typeof op.date === 'string' &&
    typeof op.comment === 'string'
  );
}

/* -------------------------------- Утилиты ------------------------------- */

function pad(n) {
  return String(n).padStart(2, '0');
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function isInCurrentMonth(dateStr) {
  const now = new Date();
  return dateStr.indexOf(now.getFullYear() + '-' + pad(now.getMonth() + 1)) === 0;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function formatMoney(n) {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ₽';
}

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return '';
  const parts = dateStr.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function uid() {
  return 'op_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/* ------------------------------- Фильтрация ----------------------------- */

function categoryListForType(type) {
  if (type === 'income') return INCOME_CATEGORIES;
  if (type === 'expense') return EXPENSE_CATEGORIES;
  return Array.from(new Set(INCOME_CATEGORIES.concat(EXPENSE_CATEGORIES)));
}

function getPeriodOperations() {
  if (filters.period === 'month') return operations.filter(function (o) {
    return isInCurrentMonth(o.date);
  });
  return operations.slice();
}

function applyFilters(list) {
  let result = list;
  if (filters.type !== 'all') {
    result = result.filter(function (o) {
      return o.type === filters.type;
    });
  }
  if (filters.category !== 'all') {
    result = result.filter(function (o) {
      return o.category === filters.category;
    });
  }
  const query = filters.search.trim().toLowerCase();
  if (query) {
    result = result.filter(function (o) {
      return (o.comment || '').toLowerCase().indexOf(query) !== -1;
    });
  }
  return result;
}

function sortOperations(list) {
  return list.slice().sort(function (a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

/* ------------------------------- Отрисовка ------------------------------ */

function render() {
  const periodOps = getPeriodOperations();
  updateSummary(periodOps);
  const filtered = sortOperations(applyFilters(periodOps));
  renderList(filtered, periodOps.length);
  renderCount(filtered.length, periodOps.length);
  updateCategoryFilter();
  updateResetButton();
  renderActiveFilters();
  renderDemoBanner();
}

function renderDemoBanner() {
  if (demoMode && operations.length === 0) setDemoMode(false);
  els.demoBanner.classList.toggle('hidden', !(demoMode && operations.length > 0));
}

function updateSummary(list) {
  let income = 0;
  let expense = 0;
  list.forEach(function (o) {
    if (o.type === 'income') income += o.amount;
    else expense += o.amount;
  });
  income = round2(income);
  expense = round2(expense);
  const balance = round2(income - expense);

  els.incomeTotal.textContent = '+' + formatMoney(income);
  els.expenseTotal.textContent = '−' + formatMoney(expense);
  els.balance.textContent = formatMoney(balance);
  els.balance.classList.toggle('value-negative', balance < 0);
}

function renderCount(filteredCount, periodCount) {
  if (operations.length === 0) {
    els.operationsCount.textContent = '';
    return;
  }
  const scope = filters.period === 'month' ? 'за текущий месяц' : 'за всё время';
  const filtersActive = filters.type !== 'all' || filters.category !== 'all' || filters.search.trim() !== '';

  if (filtersActive) {
    els.operationsCount.textContent =
      'Показано ' + filteredCount + ' из ' + periodCount + ' ' + plural(periodCount, 'операции', 'операций', 'операций') + ' ' + scope;
  } else {
    els.operationsCount.textContent =
      periodCount + ' ' + plural(periodCount, 'операция', 'операции', 'операций') + ' ' + scope;
  }
}

function updateCategoryFilter() {
  const cats = categoryListForType(filters.type);

  if (filters.category !== 'all' && cats.indexOf(filters.category) === -1) {
    filters.category = 'all';
  }

  els.categoryFilter.innerHTML = '';
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'Все категории';
  els.categoryFilter.appendChild(allOption);

  cats.forEach(function (cat) {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    els.categoryFilter.appendChild(opt);
  });

  els.categoryFilter.value = filters.category;
}

function updateResetButton() {
  const active = filters.type !== 'all' || filters.category !== 'all' || filters.search.trim() !== '';
  els.resetFiltersBtn.classList.toggle('hidden', !active);
}

function renderActiveFilters() {
  const chips = [];

  if (filters.type === 'income') chips.push({ kind: 'type', label: 'Тип: Доходы' });
  else if (filters.type === 'expense') chips.push({ kind: 'type', label: 'Тип: Расходы' });

  if (filters.category !== 'all') chips.push({ kind: 'category', label: 'Категория: ' + filters.category });

  const query = filters.search.trim();
  if (query) chips.push({ kind: 'search', label: 'Поиск: «' + query + '»' });

  const visible = chips.length > 0;
  els.activeFilters.classList.toggle('hidden', !visible);
  els.activeFilters.innerHTML = '';
  if (!visible) return;

  chips.forEach(function (chip) {
    const chipEl = document.createElement('span');
    chipEl.className = 'filter-chip';

    const label = document.createElement('span');
    label.textContent = chip.label;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.dataset.filterKind = chip.kind;
    removeBtn.setAttribute('aria-label', 'Убрать фильтр: ' + chip.label);
    removeBtn.textContent = '✕';

    chipEl.appendChild(label);
    chipEl.appendChild(removeBtn);
    els.activeFilters.appendChild(chipEl);
  });

  const resetAll = document.createElement('button');
  resetAll.type = 'button';
  resetAll.className = 'active-reset';
  resetAll.textContent = 'Сбросить всё';
  els.activeFilters.appendChild(resetAll);
}

function resetFilters() {
  filters.type = 'all';
  filters.category = 'all';
  filters.search = '';
  els.typeFilter.value = 'all';
  els.categoryFilter.value = 'all';
  els.searchInput.value = '';
  render();
}

function renderList(filtered, periodCount) {
  const noOperations = operations.length === 0;
  const nothingFound = filtered.length === 0 && !noOperations;

  els.emptyState.classList.toggle('hidden', !noOperations);
  els.filteredEmpty.classList.toggle('hidden', !nothingFound);
  els.operationsList.classList.toggle('hidden', noOperations || nothingFound);

  if (noOperations || nothingFound) {
    els.operationsList.innerHTML = '';
    return;
  }

  const fragment = document.createDocumentFragment();
  filtered.forEach(function (op) {
    fragment.appendChild(operationItem(op));
  });
  els.operationsList.innerHTML = '';
  els.operationsList.appendChild(fragment);
}

function operationItem(op) {
  const li = document.createElement('li');
  li.className = 'operation-item';
  li.dataset.id = op.id;

  const isIncome = op.type === 'income';
  const sign = isIncome ? '+' : '−';

  li.innerHTML =
    '<div class="op-icon ' + op.type + '">' + sign + '</div>' +
    '<div class="op-main">' +
      '<div class="op-title">' + escapeHtml(op.category) + '</div>' +
      '<div class="op-sub">' +
        (op.comment ? '<span class="op-comment">' + escapeHtml(op.comment) + '</span>' : '') +
        '<span class="op-date">' + formatDate(op.date) + '</span>' +
      '</div>' +
    '</div>' +
    '<span class="op-amount ' + op.type + '">' + sign + formatMoney(op.amount) + '</span>' +
    '<div class="op-actions">' +
      '<button type="button" class="icon-btn" data-action="edit" title="Редактировать" aria-label="Редактировать">✏️</button>' +
      '<button type="button" class="icon-btn danger" data-action="delete" title="Удалить" aria-label="Удалить">🗑️</button>' +
    '</div>';

  return li;
}

/* ------------------------------ Модальное окно -------------------------- */

function openOverlay(overlay) {
  overlay.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeOverlay(overlay) {
  overlay.classList.add('hidden');
  if (
    els.operationOverlay.classList.contains('hidden') &&
    els.confirmOverlay.classList.contains('hidden')
  ) {
    document.body.classList.remove('modal-open');
  }
}

function openOperationModal(op) {
  resetFieldErrors();
  editingId = op ? op.id : null;
  els.modalTitle.textContent = op ? 'Редактирование операции' : 'Новая операция';

  setFormType(op ? op.type : 'expense');
  els.amountInput.value = op ? String(op.amount) : '';
  els.dateInput.value = op ? op.date : todayStr();
  els.commentInput.value = op ? (op.comment || '') : '';
  els.categorySelect.value = op ? op.category : '';

  openOverlay(els.operationOverlay);

  const node = els.amountInput;
  requestAnimationFrame(function () {
    node.focus();
    node.select();
  });
}

function closeOperationModal() {
  editingId = null;
  closeOverlay(els.operationOverlay);
  els.form.reset();
}

function setFormType(type) {
  formType = type;
  const isIncome = type === 'income';
  els.typeExpenseBtn.classList.toggle('active', !isIncome);
  els.typeIncomeBtn.classList.toggle('active', isIncome);
  els.typeExpenseBtn.setAttribute('aria-checked', String(!isIncome));
  els.typeIncomeBtn.setAttribute('aria-checked', String(isIncome));
  setFieldError(els.categoryField, els.categoryError, '');
  populateCategoryOptions(type, null);
}

function populateCategoryOptions(type, keepCategory) {
  const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Выберите категорию';
  placeholder.disabled = true;

  els.categorySelect.innerHTML = '';
  els.categorySelect.appendChild(placeholder);

  cats.forEach(function (cat) {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    els.categorySelect.appendChild(opt);
  });

  els.categorySelect.value = cats.indexOf(keepCategory) !== -1 ? keepCategory : '';
}

function validateAmountValue(raw) {
  const cleaned = String(raw != null ? raw : '').replace(',', '.').trim();
  if (cleaned === '') return 'Укажите сумму.';
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return 'Сумма должна быть положительным числом, до 2 знаков после запятой.';
  }
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num > 9999999999) return 'Слишком большая сумма.';
  if (num <= 0) return 'Сумма должна быть больше нуля.';
  return '';
}

function setFieldError(fieldEl, errorEl, message) {
  errorEl.textContent = message || '';
  errorEl.classList.toggle('hidden', !message);
  fieldEl.classList.toggle('field-invalid', !!message);
  const control = fieldEl.querySelector('input, select');
  if (control) control.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function resetFieldErrors() {
  setFieldError(els.amountField, els.amountError, '');
  setFieldError(els.dateField, els.dateError, '');
  setFieldError(els.categoryField, els.categoryError, '');
}

function handleFormSubmit(e) {
  e.preventDefault();

  const amountRaw = els.amountInput.value;
  const category = els.categorySelect.value;
  const date = els.dateInput.value;
  const comment = els.commentInput.value.trim();

  const amountError = validateAmountValue(amountRaw);
  const categoryError = category ? '' : 'Выберите категорию.';
  const dateError = date ? '' : 'Укажите дату операции.';

  setFieldError(els.amountField, els.amountError, amountError);
  setFieldError(els.categoryField, els.categoryError, categoryError);
  setFieldError(els.dateField, els.dateError, dateError);

  if (amountError || categoryError || dateError) {
    if (amountError) els.amountInput.focus();
    else if (dateError) els.dateInput.focus();
    else els.categorySelect.focus();
    return;
  }

  const amount = round2(Number(amountRaw.replace(',', '.')));

  const data = { type: formType, amount: amount, category: category, date: date, comment: comment };

  if (editingId) {
    const index = operations.findIndex(function (o) {
      return o.id === editingId;
    });
    if (index !== -1) {
      operations[index] = Object.assign({}, operations[index], data, { updatedAt: Date.now() });
    }
  } else {
    operations.push(Object.assign({ id: uid(), createdAt: Date.now() }, data));
  }

  saveOperations();
  closeOperationModal();
  render();
}

/* ------------------------------ Удаление -------------------------------- */

function requestDelete(id) {
  const op = operations.find(function (o) {
    return o.id === id;
  });
  if (!op) return;

  pendingDeleteId = id;
  pendingClearAll = false;
  els.confirmTitle.textContent = 'Удалить операцию?';
  const typeLabel = op.type === 'income' ? 'Доход' : 'Расход';
  const commentPart = op.comment ? ' «' + op.comment + '»' : '';
  els.confirmText.textContent =
    typeLabel + ' — ' + op.category + commentPart + ': ' + formatMoney(op.amount) + ' (' + formatDate(op.date) + ').';

  openOverlay(els.confirmOverlay);
}

function requestClearAll() {
  pendingDeleteId = null;
  pendingClearAll = true;
  els.confirmTitle.textContent = 'Очистить весь список?';
  els.confirmText.textContent =
    'Все операции (' + operations.length + ' шт.) будут удалены без возможности восстановления. Список станет пустым.';
  openOverlay(els.confirmOverlay);
}

function closeConfirm() {
  pendingDeleteId = null;
  pendingClearAll = false;
  closeOverlay(els.confirmOverlay);
}

function confirmAction() {
  if (pendingClearAll) {
    operations = [];
    setDemoMode(false);
    saveOperations();
    closeConfirm();
    resetFilters();
    return;
  }
  if (!pendingDeleteId) return;
  operations = operations.filter(function (o) {
    return o.id !== pendingDeleteId;
  });
  saveOperations();
  closeConfirm();
  render();
}

/* -------------------------------- События ------------------------------- */

els.addBtn.addEventListener('click', function () {
  openOperationModal();
});

els.emptyAddBtn.addEventListener('click', function () {
  openOperationModal();
});

els.typeExpenseBtn.addEventListener('click', function () {
  setFormType('expense');
});

els.typeIncomeBtn.addEventListener('click', function () {
  setFormType('income');
});

els.form.addEventListener('submit', handleFormSubmit);
els.formCancelBtn.addEventListener('click', closeOperationModal);
els.operationOverlay.addEventListener('click', function (e) {
  if (e.target === els.operationOverlay) closeOperationModal();
});

els.periodSelect.addEventListener('change', function (e) {
  filters.period = e.target.value;
  render();
});

els.typeFilter.addEventListener('change', function (e) {
  filters.type = e.target.value;
  if (filters.category !== 'all' && categoryListForType(filters.type).indexOf(filters.category) === -1) {
    filters.category = 'all';
  }
  render();
});

els.categoryFilter.addEventListener('change', function (e) {
  filters.category = e.target.value;
  render();
});

els.searchInput.addEventListener('input', function (e) {
  filters.search = e.target.value;
  render();
});

els.resetFiltersBtn.addEventListener('click', function () {
  resetFilters();
});

els.activeFilters.addEventListener('click', function (e) {
  const removeBtn = e.target.closest('[data-filter-kind]');
  if (removeBtn) {
    const kind = removeBtn.dataset.filterKind;
    if (kind === 'type') {
      filters.type = 'all';
      els.typeFilter.value = 'all';
    } else if (kind === 'category') {
      filters.category = 'all';
      els.categoryFilter.value = 'all';
    } else if (kind === 'search') {
      filters.search = '';
      els.searchInput.value = '';
    }
    render();
    return;
  }
  if (e.target.closest('.active-reset')) {
    resetFilters();
  }
});

els.amountInput.addEventListener('input', function () {
  if (els.amountField.classList.contains('field-invalid')) {
    setFieldError(els.amountField, els.amountError, '');
  }
});

els.dateInput.addEventListener('change', function () {
  if (els.dateField.classList.contains('field-invalid')) {
    setFieldError(els.dateField, els.dateError, '');
  }
});

els.categorySelect.addEventListener('change', function () {
  if (els.categoryField.classList.contains('field-invalid')) {
    setFieldError(els.categoryField, els.categoryError, '');
  }
});

els.operationsList.addEventListener('click', function (e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const item = e.target.closest('.operation-item');
  if (!item) return;
  const id = item.dataset.id;

  if (btn.dataset.action === 'edit') {
    const op = operations.find(function (o) {
      return o.id === id;
    });
    if (op) openOperationModal(op);
  } else if (btn.dataset.action === 'delete') {
    requestDelete(id);
  }
});

els.confirmDeleteBtn.addEventListener('click', confirmAction);
els.confirmCancelBtn.addEventListener('click', closeConfirm);
els.confirmOverlay.addEventListener('click', function (e) {
  if (e.target === els.confirmOverlay) closeConfirm();
});

els.demoClearBtn.addEventListener('click', requestClearAll);
els.demoDismissBtn.addEventListener('click', function () {
  setDemoMode(false);
  render();
});

document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  if (!els.operationOverlay.classList.contains('hidden')) {
    closeOperationModal();
  } else if (!els.confirmOverlay.classList.contains('hidden')) {
    closeConfirm();
  }
});

/* --------------------------------- Старт -------------------------------- */

function init() {
  demoMode = loadDemoFlag();
  maybeSeedDemoData();
  els.periodSelect.value = filters.period;
  els.typeFilter.value = filters.type;
  els.categoryFilter.value = filters.category;
  els.dateInput.value = todayStr();
  render();
}

init();