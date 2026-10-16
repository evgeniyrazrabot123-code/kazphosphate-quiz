let globalResults = [];
let globalQuestions = [];
let adminToken = '';
const API_BASE = window.location.origin;

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

const DEFAULT_SPECIALTIES = {
    'dumper': 'Водитель карьерного самосвала',
    'car_driver': 'Водитель легкового автомобиля',
    'truck_driver': 'Водитель грузового автомобиля',
    'bus_driver': 'Водитель автобуса',
    'trailer_driver': 'Водитель автомобиля с прицепом',
    'fuel_driver': 'Водитель топливозаправщика',
    'dopog_driver': 'Водитель (ДОПОГ)',
    'excavator': 'Машинист экскаватора',
    'loader': 'Машинист фронтального погрузчика',
    'bulldozer': 'Машинист бульдозера',
    'grader': 'Машинист автогрейдера',
    'roller': 'Машинист дорожного катка',
    'telehandler': 'Машинист телескопического погрузчика',
    'drilling_rig': 'Машинист буровой установки',
    'operator': 'Оператор технологического оборудования',
    'auto_mechanic': 'Слесарь по ремонту автомобилей',
    'machinery_mechanic': 'Слесарь по ремонту самоходной техники',
    'mechanic': 'Механик участка',
    'foreman': 'Мастер участка',
    'other': 'Другая должность'
};

function getSpecialties() {
    const saved = localStorage.getItem('kpp_specialties');
    if (!saved) return DEFAULT_SPECIALTIES;
    try {
        const parsed = JSON.parse(saved);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : DEFAULT_SPECIALTIES;
    } catch (error) {
        console.warn('Некорректный список специальностей в localStorage', error);
        return DEFAULT_SPECIALTIES;
    }
}

function saveSpecialties(specs) {
    localStorage.setItem('kpp_specialties', JSON.stringify(specs));
    populateCategorySelects();

    // Попытка синхронизировать специальности на сервере (если авторизован админ)
    if (adminToken) {
        adminFetch('/api/admin/specialties/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(specs)
        }).then(() => {
            const ts = new Date().toLocaleTimeString();
            setSyncStatus(`Синхронизировано: ${ts}`, true);
        }).catch(() => {
            setSyncStatus('Ошибка синхронизации', false);
        });
    }
}


const positionNames = new Proxy({}, {
    get(target, prop) {
        const specs = getSpecialties();
        return specs[prop] || prop;
    },
    ownKeys(target) {
        return Object.keys(getSpecialties());
    },
    getOwnPropertyDescriptor(target, prop) {
        return { configurable: true, enumerable: true, value: getSpecialties()[prop] };
    }
});

function adminFetch(path, options = {}) {
    options.headers = options.headers || {};
    if (adminToken) {
        options.headers['Authorization'] = `Bearer ${adminToken}`;
    }
    return fetch(`${API_BASE}${path}`, options).then(async response => {
        if (response.status === 401) {
            showLoginScreen('Сессия истекла или неверный токен. Пожалуйста, войдите снова.');
            throw new Error('Unauthorized');
        }
        if (response.status === 503) {
            const error = await response.clone().json().catch(() => ({}));
            const message = error.detail || 'Сервис временно недоступен. Проверьте настройки Render.';
            showLoginScreen(message);
            throw new Error(message);
        }
        return response;
    });
}

// Local-only write of specialties (no server sync)
function setLocalSpecialties(specs) {
    try {
        localStorage.setItem('kpp_specialties', JSON.stringify(specs));
    } catch (e) {
        console.warn('setLocalSpecialties error', e);
    }
}

function setSyncStatus(text, ok = true) {
    const node = document.getElementById('sync-status');
    if (!node) return;
    node.innerText = text;
    node.className = ok ? 'text-[12px] text-emerald-700 font-medium' : 'text-[12px] text-red-600 font-medium';
}

async function refreshSpecialtiesNow() {
    setSyncStatus('Синхронизация...');
    try {
        const resp = await adminFetch('/api/admin/specialties');
        const list = await resp.json();
        const map = {};
        list.forEach(s => { map[s.code] = s.name_ru; });
        setLocalSpecialties(map);
        populateCategorySelects();
        renderSpecialtiesTable();
        const ts = new Date().toLocaleTimeString();
        setSyncStatus(`Синхронизировано: ${ts}`, true);
    } catch (e) {
        console.warn('refreshSpecialtiesNow error', e);
        setSyncStatus('Ошибка синхронизации', false);
    }
}

function showLoginScreen(message) {
    document.getElementById('admin-login-screen')?.classList.remove('hidden');
    document.getElementById('admin-app')?.classList.add('hidden');
    const errorNode = document.getElementById('login-error');
    if (errorNode) {
        errorNode.innerText = message || '';
        errorNode.classList.toggle('hidden', !message);
    }
}

function showAdminApp() {
    document.getElementById('admin-login-screen')?.classList.add('hidden');
    document.getElementById('admin-app')?.classList.remove('hidden');
}

function populateCategorySelects() {
    const selectElem = document.getElementById('q_category');
    if (!selectElem) return;

    selectElem.innerHTML = '';

    // Попробуем загрузить специальности с сервера (если доступен), иначе используем localStorage
    const tryServer = () => {
        return adminFetch('/api/admin/specialties').then(r => r.json()).then(list => {
            // admin endpoint returns array of {code,name_ru}
            list.forEach(s => {
                const option = document.createElement('option');
                option.value = s.code;
                option.textContent = s.name_ru;
                selectElem.appendChild(option);
            });
            return true;
        }).catch(() => false);
    };

    // If adminToken present try admin endpoint, else try public /api/specialties
    const serverPromise = adminToken ? tryServer() : fetch(`${API_BASE}/api/specialties`).then(r => r.ok ? r.json() : Promise.reject()).then(obj => {
        for (const [key, name] of Object.entries(obj)) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = name;
            selectElem.appendChild(option);
        }
        return true;
    }).catch(() => false);

    serverPromise.then(success => {
        if (!success) {
            const specs = getSpecialties();
            for (const [key, name] of Object.entries(specs)) {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = name;
                selectElem.appendChild(option);
            }
        }
    });
}

// ------------------------------------------------------------------
// 1. АВТОРИЗАЦИЯ
// ------------------------------------------------------------------
async function loginAdmin(e) {
    e.preventDefault();
    const username = document.getElementById('admin-login')?.value.trim();
    const password = document.getElementById('admin-password')?.value;
    const errorNode = document.getElementById('login-error');

    try {
        const body = new URLSearchParams();
        body.append('username', username);
        body.append('password', password);

        const response = await fetch(`${API_BASE}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(response.status === 503 ? error.detail : 'Неверный логин или пароль.');
        }

        const data = await response.json();
        adminToken = data.token;
        localStorage.setItem('adminToken', adminToken);
        showAdminApp();
        switchTab('results');
    } catch (err) {
        if (errorNode) {
            errorNode.innerText = err.message || 'Неверный логин или пароль.';
            errorNode.classList.remove('hidden');
        }
    }
}

function logoutAdmin() {
    localStorage.removeItem('adminToken');
    adminToken = '';
    showLoginScreen('');
}

// ------------------------------------------------------------------
// 2. ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК
// ------------------------------------------------------------------
function switchTab(tab) {
    const activeClass = "px-4 py-2 font-bold rounded bg-slate-900 text-white text-xs uppercase tracking-wider transition";
    const inactiveClass = "px-4 py-2 font-bold rounded text-slate-600 hover:text-slate-900 bg-white border border-slate-300 text-xs uppercase tracking-wider transition";

    ['dashboard', 'results', 'questions-list', 'add-question', 'specialties', 'guide'].forEach(t => {
        document.getElementById(`tab-${t}`)?.classList.add('hidden');
        const btn = document.getElementById(`tab-${t}-btn`);
        if (btn) btn.className = inactiveClass;
    });

    const targetTabId = tab.replace('_', '-');
    document.getElementById(`tab-${targetTabId}`)?.classList.remove('hidden');
    const targetBtn = document.getElementById(`tab-${targetTabId}-btn`);
    if (targetBtn) targetBtn.className = activeClass;

    if (tab === 'dashboard') renderDashboard();
    else if (tab === 'results') loadResults();
    else if (tab === 'questions_list') loadQuestionsList();
    else if (tab === 'add_question') populateCategorySelects();
    else if (tab === 'specialties') renderSpecialtiesTable();
}

// ------------------------------------------------------------------
// 3. УПРАВЛЕНИЕ СПЕЦИАЛЬНОСТЯМИ
// ------------------------------------------------------------------
function getSpecialtiesKk() {
    const saved = localStorage.getItem('kpp_specialties_kk');
    if (!saved) return {};
    try {
        const parsed = JSON.parse(saved);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
        console.warn('Некорректные названия специальностей на казахском в localStorage', error);
        return {};
    }
}

function setSpecialtiesKk(specsKk) {
    try {
        localStorage.setItem('kpp_specialties_kk', JSON.stringify(specsKk));
    } catch (e) {
        console.warn('setSpecialtiesKk error', e);
    }
}

function renderSpecialtiesTable() {
    const tbody = document.getElementById('specialties-table-body');
    if (!tbody) return;
    const specsKk = getSpecialtiesKk();
    const renderRows = list => {
        tbody.replaceChildren();
        list.forEach(spec => {
            const { code, name_ru: name, name_kk: nameKk } = spec;
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50 transition-colors';
            [
                [code, 'p-3 border-r border-slate-100 font-mono text-[11px] text-slate-500'],
                [name, 'p-3 border-r border-slate-100 font-bold text-slate-900'],
                [nameKk || specsKk[code] || name, 'p-3 border-r border-slate-100 text-slate-700']
            ].forEach(([value, className]) => {
                const cell = document.createElement('td');
                cell.className = className;
                cell.textContent = value || '';
                tr.appendChild(cell);
            });

            const actions = document.createElement('td');
            actions.className = 'p-3 text-center space-x-2';
            const editButton = document.createElement('button');
            editButton.type = 'button';
            editButton.className = 'text-blue-600 hover:underline font-bold text-xs';
            editButton.textContent = 'Изменить';
            editButton.addEventListener('click', () => editSpecialty(code, name, nameKk || specsKk[code] || name));
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'text-red-600 hover:underline font-bold text-xs';
            deleteButton.textContent = 'Удалить';
            deleteButton.addEventListener('click', () => deleteSpecialty(code));
            actions.append(editButton, deleteButton);
            tr.appendChild(actions);
            tbody.appendChild(tr);
        });
    };

    if (adminToken) {
        adminFetch('/api/admin/specialties')
            .then(response => response.json())
            .then(renderRows)
            .catch(() => renderRows(Object.entries(getSpecialties()).map(([code, name_ru]) => ({
                code,
                name_ru,
                name_kk: specsKk[code] || name_ru
            }))));
        return;
    }

    renderRows(Object.entries(getSpecialties()).map(([code, name_ru]) => ({
        code,
        name_ru,
        name_kk: specsKk[code] || name_ru
    })));
}

function saveSpecialty(e) {
    e.preventDefault();
    const keyInput = document.getElementById('spec-key');
    const nameInput = document.getElementById('spec-name');
    const nameKkInput = document.getElementById('spec-name-kk');
    const oldKeyInput = document.getElementById('spec-old-key');

    const key = keyInput.value.trim().toLowerCase().replace(/\s+/g, '_');
    const name = nameInput.value.trim();
    const nameKk = nameKkInput.value.trim();
    const oldKey = oldKeyInput.value.trim();

    if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(key)) {
        alert('Код должен содержать только латинские строчные буквы, цифры и подчёркивания.');
        return;
    }
    if (oldKey && oldKey !== key) {
        alert('Системный код нельзя менять: он связан с вопросами. Измените только названия.');
        return;
    }

    let specs = getSpecialties();
    let specsKk = getSpecialtiesKk();

    specs[key] = name;
    specsKk[key] = nameKk || name;
    saveSpecialties(specs);
    setSpecialtiesKk(specsKk);

    if (adminToken) {
        const form = new URLSearchParams();
        form.append('code', key);
        form.append('name_ru', name);
        form.append('name_kk', nameKk || name);
        adminFetch('/api/admin/specialties', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: form.toString()
        }).then(() => {
            resetSpecForm();
            renderSpecialtiesTable();
            populateCategorySelects();
            alert('Специальность успешно сохранена на сервере!');
        }).catch(() => {
            resetSpecForm();
            renderSpecialtiesTable();
            populateCategorySelects();
            alert('Специальность сохранена локально, но не удалось синхронизировать с сервером.');
        });
        return;
    }

    resetSpecForm();
    renderSpecialtiesTable();
    alert('Специальность успешно сохранена!');
}

function editSpecialty(key, name, nameKk = '') {
    document.getElementById('spec-key').value = key;
    document.getElementById('spec-key').disabled = true;
    document.getElementById('spec-name').value = name;
    document.getElementById('spec-name-kk').value = nameKk || '';
    document.getElementById('spec-old-key').value = key;
    document.getElementById('spec-submit-btn').textContent = 'Сохранить изменения';
}

function deleteSpecialty(key) {
    if (!confirm(`Удалить специальность "${key}"?`)) return;
    let specs = getSpecialties();
    delete specs[key];
    saveSpecialties(specs);
    // Если админ — удалим на сервере тоже
    if (adminToken) {
        adminFetch(`/api/admin/specialties/${encodeURIComponent(key)}`, { method: 'DELETE' }).then(() => {
            renderSpecialtiesTable();
            populateCategorySelects();
            const ts = new Date().toLocaleTimeString();
            setSyncStatus(`Синхронизировано: ${ts}`, true);
        }).catch(() => {
            renderSpecialtiesTable();
            populateCategorySelects();
            setSyncStatus('Ошибка синхронизации', false);
            alert('Специальность удалена локально, но не удалось удалить на сервере.');
        });
        return;
    }

    renderSpecialtiesTable();

}

function resetSpecForm() {
    document.getElementById('specialty-form')?.reset();
    document.getElementById('spec-key').disabled = false;
    document.getElementById('spec-old-key').value = '';
    document.getElementById('spec-submit-btn').textContent = 'Добавить специальность';
}

// ------------------------------------------------------------------
// 4. ЗАГРУЗКА РЕЗУЛЬТАТОВ И БЕЙДЖИ
// ------------------------------------------------------------------
function getResultPassed(res) {
    if (!res || !Number.isFinite(Number(res.total_questions)) || Number(res.total_questions) <= 0) {
        return false;
    }
    return Number(res.score) >= Number(res.total_questions) * 0.7;
}

function parseDateFromResult(dateString) {
    if (!dateString) return null;
    const text = String(dateString).trim();
    if (!text || text === '—') return null;

    const match = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (match) {
        const [, day, month, year] = match;
        const date = new Date(Number(year), Number(month) - 1, Number(day));
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const value = new Date(text);
    return Number.isNaN(value.getTime()) ? null : value;
}

function getLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function renderDashboard() {
    const totalNode = document.getElementById('dashboard-total');
    const passNode = document.getElementById('dashboard-pass');
    const failNode = document.getElementById('dashboard-fail');
    const rateNode = document.getElementById('dashboard-rate');
    const ringNode = document.getElementById('dashboard-ring');
    const resultsTotalNode = document.getElementById('results-total');
    const resultsPassNode = document.getElementById('results-pass');
    const resultsFailNode = document.getElementById('results-fail');
    const resultsRateNode = document.getElementById('results-rate');
    const resultsRingNode = document.getElementById('results-ring');
    const specialtiesNode = document.getElementById('dashboard-specialties');
    const datesNode = document.getElementById('dashboard-dates');
    const statusNode = document.getElementById('dashboard-status-list');

    if (!Array.isArray(globalResults) || !totalNode || !passNode || !failNode || !rateNode || !ringNode || !specialtiesNode || !datesNode) return;

    const total = globalResults.length;
    const passed = globalResults.filter(getResultPassed).length;
    const failed = total - passed;
    const passRate = total ? Math.round((passed / total) * 100) : 0;

    totalNode.textContent = String(total);
    passNode.textContent = String(passed);
    failNode.textContent = String(failed);
    rateNode.textContent = `${passRate}%`;
    ringNode.style.setProperty('--pass-rate', `${passRate}%`);
    ringNode.setAttribute('aria-label', `${passRate}% сотрудников сдали тест`);
    if (resultsTotalNode) resultsTotalNode.textContent = String(total);
    if (resultsPassNode) resultsPassNode.textContent = String(passed);
    if (resultsFailNode) resultsFailNode.textContent = String(failed);
    if (resultsRateNode) resultsRateNode.textContent = `${passRate}%`;
    if (resultsRingNode) resultsRingNode.style.background = `conic-gradient(#16a34a 0 ${passRate}%, #ef4444 ${passRate}% 100%)`;
    if (statusNode) {
        statusNode.innerHTML = `
            <div class="rounded-lg border border-emerald-200 bg-white p-3"><div class="text-[10px] uppercase text-emerald-700">Сдали</div><div class="mt-1 text-xl font-black text-emerald-700">${passed}</div></div>
            <div class="rounded-lg border border-red-200 bg-white p-3"><div class="text-[10px] uppercase text-red-700">Не сдали</div><div class="mt-1 text-xl font-black text-red-700">${failed}</div></div>
        `;
    }

    const specs = getSpecialties();
    const specialtyMap = {};
    globalResults.forEach(res => {
        const key = res.position || 'unknown';
        if (!specialtyMap[key]) {
            specialtyMap[key] = { total: 0, passed: 0 };
        }
        specialtyMap[key].total += 1;
        if (getResultPassed(res)) specialtyMap[key].passed += 1;
    });

    const specialtyEntries = Object.entries(specialtyMap).sort((a, b) => b[1].total - a[1].total);
    specialtiesNode.innerHTML = specialtyEntries.length
        ? specialtyEntries.map(([code, data]) => {
            const title = escapeHtml(specs[code] || code || 'Без категории');
            const pct = Math.round((data.passed / data.total) * 100);
            return `
                <div class="space-y-2">
                    <div class="flex items-end justify-between gap-3">
                        <div class="min-w-0 truncate text-xs font-bold text-slate-800">${title}</div>
                        <div class="shrink-0 text-[10px] font-semibold tabular-nums text-slate-500">${data.passed} из ${data.total} <span class="ml-1 font-extrabold text-slate-800">${pct}%</span></div>
                    </div>
                    <div class="h-2 overflow-hidden rounded-sm bg-slate-100" role="img" aria-label="${title}: успешно ${pct}%">
                        <div class="h-full rounded-sm ${pct >= 70 ? 'bg-emerald-600' : 'bg-[#C8102E]'}" style="width: ${pct}%"></div>
                    </div>
                </div>
            `;
        }).join('')
        : '<div class="flex min-h-32 items-center justify-center border border-dashed border-slate-300 text-xs text-slate-500">Пока нет результатов тестирования</div>';

    const dateMap = {};
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const key = getLocalDateKey(date);
        dateMap[key] = 0;
    }

    globalResults.forEach(res => {
        const parsed = parseDateFromResult(res.passed_at);
        if (!parsed) return;
        const key = getLocalDateKey(parsed);
        if (Object.prototype.hasOwnProperty.call(dateMap, key)) {
            dateMap[key] += 1;
        }
    });

    const dateEntries = Object.entries(dateMap).map(([key, count]) => ({
        label: new Date(`${key}T00:00:00`).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }),
        count
    }));

    const maxDailyCount = Math.max(...dateEntries.map(item => item.count), 1);
    datesNode.innerHTML = dateEntries.map(item => {
        const barHeight = item.count ? Math.max((item.count / maxDailyCount) * 100, 8) : 3;
        return `
            <div class="dashboard-week-day" title="${item.label}: ${item.count} тестов">
                <span class="text-[10px] font-bold tabular-nums text-slate-700">${item.count || ''}</span>
                <div class="dashboard-week-track" role="img" aria-label="${item.label}: ${item.count} тестов">
                    <div class="dashboard-week-bar" style="height: ${barHeight}%"></div>
                </div>
                <span class="dashboard-week-day-label">${item.label}</span>
            </div>
        `;
    }).join('');
}

function renderResultsTable() {
    const tbody = document.getElementById('results-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!Array.isArray(globalResults) || globalResults.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400 font-bold">Результаты тестирования в базе данных отсутствуют</td></tr>`;
        return;
    }

    const searchValue = (document.getElementById('search-results')?.value || '').trim().toLowerCase();
    const filterSpec = document.getElementById('filter-spec')?.value || '';
    const filterStatus = document.getElementById('filter-status')?.value || '';
    const specs = getSpecialties();

    const filtered = globalResults.filter(res => {
        const matchesSearch = !searchValue || String(res.full_name || '').toLowerCase().includes(searchValue) || String(res.iin || '').toLowerCase().includes(searchValue);
        const matchesSpec = !filterSpec || (res.position || '') === filterSpec;
        const passed = getResultPassed(res);
        const matchesStatus = !filterStatus || (filterStatus === 'pass' && passed) || (filterStatus === 'fail' && !passed);
        return matchesSearch && matchesSpec && matchesStatus;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400 font-bold">Нет результатов по выбранным фильтрам</td></tr>`;
        return;
    }

    filtered.forEach((res, index) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/80 transition-colors';

        const docs = [];
        if (res.photo_user) docs.push(['Фото 3x4', res.photo_user]);
        if (res.photo_license) docs.push(['Водительское удостоверение', res.photo_license]);
        if (res.photo_id_card) docs.push(['Уд. Машиниста', res.photo_id_card]);

        const docsHtml = docs.length > 0
            ? docs.map(([label, url]) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline font-bold">${escapeHtml(label)}</a>`).join(' | ')
            : '<span class="text-slate-400">Нет</span>';
        const prettyPosition = specs[res.position] || res.position;
        const passed = getResultPassed(res);

        tr.innerHTML = `
            <td class="p-3 border-r border-slate-100 font-mono text-[11px] text-slate-500">${escapeHtml(res.passed_at)}</td>
            <td class="p-3 border-r border-slate-100 font-bold text-slate-900">${escapeHtml(res.full_name)}</td>
            <td class="p-3 border-r border-slate-100 text-slate-700">${escapeHtml(prettyPosition)}</td>
            <td class="p-3 border-r border-slate-100 font-extrabold ${passed ? 'text-emerald-700' : 'text-red-600'}">${escapeHtml(res.score)} / ${escapeHtml(res.total_questions)}</td>
            <td class="p-3 border-r border-slate-100">${docsHtml}</td>
            <td class="p-3 text-center border-r border-slate-100">
                <button onclick="openBadgeModal(${globalResults.indexOf(res)})" class="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-extrabold uppercase transition text-[10px] shadow-sm">🪪 Пропуск</button>
            </td>
            <td class="p-3 text-center">
                <button onclick="deleteResult(${res.id})" class="px-3 py-1.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-lg font-extrabold uppercase transition text-[10px] border border-red-200">Удалить</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function loadResults() {
    try {
        const response = await adminFetch('/api/admin/results');
        if (!response.ok) throw new Error('Не удалось загрузить результаты');
        globalResults = await response.json();
        populateResultFilter();
        renderDashboard();
        renderResultsTable();
    } catch (err) {
        console.error("Ошибка загрузки результатов:", err);
    }
}

function populateResultFilter() {
    const select = document.getElementById('filter-spec');
    if (!select) return;
    const selected = select.value;
    const specs = getSpecialties();
    const codes = [...new Set(globalResults.map(result => result.position).filter(Boolean))].sort();
    select.replaceChildren(new Option('Все специальности', ''));
    codes.forEach(code => select.add(new Option(specs[code] || code, code)));
    if (codes.includes(selected)) select.value = selected;
}

async function deleteResult(id) {
    if (!confirm("Удалить этот результат из базы данных?")) return;
    try {
        const response = await adminFetch(`/api/admin/results/${id}`, { method: 'DELETE' });
        if (response.ok) loadResults();
    } catch (err) {
        alert('Ошибка связи с сервером');
    }
}

async function exportResultsCSV() {
    try {
        const response = await adminFetch('/api/admin/results/export/csv');
        if (!response.ok) throw new Error();
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kazphosphate_results_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    } catch (err) {
        alert('Не удалось выгрузить данные.');
    }
}

async function exportResultsXLSX() {
    try {
        const response = await adminFetch('/api/admin/results/export/xlsx');
        if (!response.ok) throw new Error();
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kazphosphate_results_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    } catch (err) {
        alert('Не удалось выгрузить данные в Excel.');
    }
}

function openBadgeModal(index) {
    const res = globalResults[index];
    if (!res) return;
    const specs = getSpecialties();

    document.getElementById('editPassId').value = res.id;
    document.getElementById('editFullName').value = res.full_name || '';
    document.getElementById('editIin').value = res.iin || '';
    document.getElementById('editPosition').value = specs[res.position] || res.position || '';
    document.getElementById('editOrganization').value = 'ТОО «КАЗФОСФАТ»';
    document.getElementById('editIssueDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('editCategory').value = 'A';

    calculateExpiryPreview();
    document.getElementById('passEditModal')?.classList.remove('hidden');
}

function closePassModal() {
    document.getElementById('passEditModal')?.classList.add('hidden');
}

function calculateExpiryPreview() {
    const issueDateVal = document.getElementById('editIssueDate')?.value;
    const category = document.getElementById('editCategory')?.value;
    const previewElem = document.getElementById('expiryPreviewText');
    if (!issueDateVal || !previewElem) return;

    const startDate = new Date(issueDateVal);
    const endDate = new Date(startDate);
    if (category === 'A') endDate.setFullYear(endDate.getFullYear() + 1);
    else if (category === 'B') endDate.setMonth(endDate.getMonth() + 6);
    else endDate.setDate(endDate.getDate() + 1);

    previewElem.innerText = endDate.toLocaleDateString('ru-RU');
}

async function savePassCard(e) {
    e.preventDefault();
    const passId = document.getElementById('editPassId')?.value;
    const payload = {
        full_name: document.getElementById('editFullName')?.value || '',
        iin: document.getElementById('editIin')?.value || '',
        position: document.getElementById('editPosition')?.value || '',
        organization: document.getElementById('editOrganization')?.value || 'ТОО «КАЗФОСФАТ»',
        category: document.getElementById('editCategory')?.value || 'A',
        issue_date: document.getElementById('editIssueDate')?.value || new Date().toISOString().split('T')[0]
    };

    try {
        const response = await adminFetch(`/api/passes/${passId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (response.ok) {
            closePassModal();
            // If admin uploaded a photo file, send it to the server
            const photoInput = document.getElementById('editPhoto');
            if (photoInput && photoInput.files && photoInput.files.length > 0) {
                try {
                    const form = new FormData();
                    form.append('photo', photoInput.files[0]);
                    await adminFetch(`/api/admin/passes/${passId}/photo`, {
                        method: 'POST',
                        body: form
                    });
                } catch (phErr) {
                    console.warn('Photo upload failed', phErr);
                }
                // Reload updated card
                try {
                    const r2 = await adminFetch(`/api/passes/${passId}`);
                    const updated = await r2.json();
                    showFinalBadge(updated, passId);
                } catch (e2) {
                    showFinalBadge(data.card, passId);
                }
            } else {
                showFinalBadge(data.card, passId);
            }
        }
    } catch (err) {
        alert('Ошибка связи с сервером');
    }
}

function showFinalBadge(card, passId) {
    const res = globalResults.find(r => r.id == passId) || {};
    const specs = getSpecialties();
    const badgeNum = String(card.id || passId).padStart(6, '0');
    const issueDate = card.issue_date ? new Date(card.issue_date) : new Date();
    const expiryDate = card.expiry_date ? new Date(card.expiry_date) : new Date();

    if (document.getElementById('badge-num')) document.getElementById('badge-num').innerText = badgeNum;
    if (document.getElementById('badge-fio')) document.getElementById('badge-fio').innerText = card.full_name || res.full_name || '—';
    if (document.getElementById('badge-pos')) document.getElementById('badge-pos').innerText = card.position || specs[res.position] || res.position || '—';
    if (document.getElementById('badge-organization')) document.getElementById('badge-organization').innerText = card.organization || 'ТОО «КАЗФОСФАТ»';
    if (document.getElementById('badge-dates')) document.getElementById('badge-dates').innerHTML = `С ${issueDate.toLocaleDateString('ru-RU')}<br>ПО ${expiryDate.toLocaleDateString('ru-RU')}`;

    const catTitle = document.getElementById('badge-category-title');
    const catSub = document.getElementById('badge-category-sub');
    if (catTitle && catSub) {
        if (card.category === 'B') {
            catTitle.innerText = 'B'; catTitle.className = 'font-black text-3xl text-amber-600 block my-0.5'; catSub.innerText = 'ВРЕМЕННЫЙ';
        } else if (card.category === 'C') {
            catTitle.innerText = 'C'; catTitle.className = 'font-black text-3xl text-blue-600 block my-0.5'; catSub.innerText = 'РАЗОВЫЙ';
        } else {
            catTitle.innerText = 'A'; catTitle.className = 'font-black text-3xl text-emerald-800 block my-0.5'; catSub.innerText = 'ПОСТОЯННЫЙ';
        }
    }

    const photoElem = document.getElementById('badge-photo');
    if (photoElem) {
        const photoUrl = (card && card.photo_url) || res.photo_user || null;
        photoElem.src = photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(card.full_name || 'K')}&background=000&color=fff&size=200`;
    }

    document.getElementById('badge-modal')?.classList.remove('hidden');
}

function closeBadgeModal() {
    document.getElementById('badge-modal')?.classList.add('hidden');
}

// ------------------------------------------------------------------
// 5. УПРАВЛЕНИЕ ВОПРОСАМИ
// ------------------------------------------------------------------
async function loadQuestionsList() {
    try {
        const response = await adminFetch('/api/admin/questions');
        if (!response.ok) throw new Error('Не удалось загрузить вопросы');
        globalQuestions = await response.json();
        populateQuestionCategoryFilter();
        renderQuestionsTable();
    } catch (err) {
        console.error("Ошибка загрузки вопросов:", err);
    }
}

function populateQuestionCategoryFilter() {
    const select = document.getElementById('filter-q-category');
    if (!select) return;
    const selected = select.value;
    const specs = getSpecialties();
    const categories = [...new Set(globalQuestions.map(question => question.category).filter(Boolean))].sort();
    select.replaceChildren(new Option('Все категории', ''));
    categories.forEach(category => select.add(new Option(specs[category] || category, category)));
    if (categories.includes(selected)) select.value = selected;
}

function renderQuestionsTable() {
    const questions = Array.isArray(globalQuestions) ? globalQuestions : [];
    const tbody = document.getElementById('questions-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const search = (document.getElementById('search-questions')?.value || '').trim().toLowerCase();
    const category = document.getElementById('filter-q-category')?.value || '';
    const filtered = questions.filter(question => {
        const matchesSearch = !search || `${question.text_ru || ''} ${question.text_kk || ''}`.toLowerCase().includes(search);
        return matchesSearch && (!category || question.category === category);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Вопросы пока не добавлены</td></tr>`;
        return;
    }

    const specs = getSpecialties();
    filtered.forEach(q => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition-colors";
        const optionsRu = Array.isArray(q.options_ru) ? q.options_ru : [];
        const optionsKk = Array.isArray(q.options_kk) ? q.options_kk : [];
        const correctIndex = Number(q.correct_option_index);
        tr.innerHTML = `
            <td class="p-3 border-r border-slate-100 font-mono text-[11px] text-slate-500">${escapeHtml(q.id)}</td>
            <td class="p-3 border-r border-slate-100 font-bold text-slate-900">${escapeHtml(specs[q.category] || q.category)}</td>
            <td class="p-3 border-r border-slate-100">
                <div class="font-bold text-slate-800 mb-0.5">${escapeHtml(q.text_ru)}</div>
                <div class="text-slate-500 italic text-[11px]">${escapeHtml(q.text_kk)}</div>
            </td>
            <td class="p-3 border-r border-slate-100 text-slate-600 text-[11px]">RU: ${optionsRu.map(escapeHtml).join(', ')}<br>KK: ${optionsKk.map(escapeHtml).join(', ')}</td>
            <td class="p-3 border-r border-slate-100 text-center font-extrabold text-emerald-700">${escapeHtml(optionsRu[correctIndex] || `№ ${correctIndex + 1}`)}<br>${escapeHtml(optionsKk[correctIndex] || '')}</td>
            <td class="p-3 text-center">
                <button onclick="deleteQuestion(${q.id})" class="px-3 py-1.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-lg font-extrabold uppercase transition text-[10px] border border-red-200">Удалить</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function deleteQuestion(id) {
    if (!confirm("Удалить этот вопрос?")) return;
    try {
        const response = await adminFetch(`/api/admin/questions/${id}`, { method: 'DELETE' });
        const res = await response.json();
        if (res.status === 'success') loadQuestionsList();
    } catch (err) {
        alert('Ошибка связи с сервером');
    }
}

function addAnswerField(lang) {
    const list = document.getElementById(`answer-list-${lang}`);
    if (!list) return;

    const items = [...list.querySelectorAll('.flex.items-center.gap-2')];
    const nextIndex = items.length;
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2';
    row.innerHTML = `
        <input type="checkbox" class="q-correct-toggle" data-lang="${lang}" data-index="${nextIndex}">
        <input type="text" data-answer="${lang}" data-index="${nextIndex}" class="flex-1 px-3 py-2 kpp-input" placeholder="${lang === 'ru' ? 'Ответ ' + (nextIndex + 1) : 'Жауап ' + (nextIndex + 1)}" required>
        <button type="button" onclick="removeAnswerField(this, '${lang}')" class="px-2 py-1 text-[10px] bg-red-100 text-red-700 hover:bg-red-200 rounded font-bold">×</button>
    `;
    list.appendChild(row);
}

function removeAnswerField(button, lang) {
    const row = button.closest('.flex.items-center.gap-2');
    const list = document.getElementById(`answer-list-${lang}`);
    if (!row || !list) return;

    const rows = [...list.querySelectorAll('.flex.items-center.gap-2')];
    if (rows.length <= 2) {
        alert('Минимум два варианта ответа.');
        return;
    }

    row.remove();
    reindexAnswerFields(lang);
}

function reindexAnswerFields(lang) {
    const rows = [...document.querySelectorAll(`#answer-list-${lang} .flex.items-center.gap-2`)]
    const selectedIndex = rows.findIndex(row => row.querySelector('.q-correct-toggle')?.checked);
    rows.forEach((row, idx) => {
        const checkbox = row.querySelector('.q-correct-toggle');
        const input = row.querySelector('[data-answer]');
        const button = row.querySelector('button');

        if (checkbox) {
            checkbox.dataset.index = idx;
            checkbox.checked = idx === (selectedIndex < 0 ? 0 : selectedIndex);
        }
        if (input) {
            input.dataset.index = idx;
            input.placeholder = lang === 'ru' ? `Ответ ${idx + 1}` : `Жауап ${idx + 1}`;
        }
        if (button) {
            button.setAttribute('onclick', `removeAnswerField(this, '${lang}')`);
        }
    });
}

function getAnswerGroupsFromForm() {
    const ruInputNodes = [...document.querySelectorAll('[data-answer="ru"]')];
    const kkInputNodes = [...document.querySelectorAll('[data-answer="kk"]')];
    const ruInputs = ruInputNodes.map(input => input.value.trim());
    const kkInputs = kkInputNodes.map(input => input.value.trim());

    const ruChecks = [...document.querySelectorAll('.q-correct-toggle[data-lang="ru"]')];
    const kkChecks = [...document.querySelectorAll('.q-correct-toggle[data-lang="kk"]')];

    const ruCorrectIndex = ruChecks.findIndex(cb => cb.checked);
    const kkCorrectIndex = kkChecks.findIndex(cb => cb.checked);

    if (ruInputs.length < 2 || kkInputs.length < 2 || ruInputs.some(value => !value) || kkInputs.some(value => !value) || ruInputs.length !== kkInputs.length) {
        return null;
    }

    if (ruCorrectIndex === -1 || kkCorrectIndex === -1 || ruChecks.filter(cb => cb.checked).length !== 1 || kkChecks.filter(cb => cb.checked).length !== 1) {
        return null;
    }

    if (ruCorrectIndex !== kkCorrectIndex) {
        return null;
    }

    return {
        options_ru: ruInputs,
        options_kk: kkInputs,
        correct_option_index: ruCorrectIndex
    };
}

async function submitQuestion(e) {
    e.preventDefault();
    const category = document.getElementById('q_category')?.value.trim();
    const text_ru = document.getElementById('q_text_ru')?.value.trim();
    const text_kk = document.getElementById('q_text_kk')?.value.trim();

    const answerData = getAnswerGroupsFromForm();
    if (!answerData) {
        alert('Заполните все варианты ответов и отметьте один правильный ответ для каждого языка.');
        return;
    }

    const formData = new FormData();
    formData.append('category', category);
    formData.append('text_ru', text_ru);
    formData.append('text_kk', text_kk);
    formData.append('options_ru', JSON.stringify(answerData.options_ru));
    formData.append('options_kk', JSON.stringify(answerData.options_kk));
    formData.append('correct_option_index', String(answerData.correct_option_index));

    try {
        const response = await adminFetch('/api/admin/questions', { method: 'POST', body: formData });
        const res = await response.json();
        if (res.status === 'success') {
            alert('Вопрос успешно сохранен!');
            document.getElementById('add-question-form')?.reset();
            ['ru', 'kk'].forEach(lang => {
                const list = document.getElementById(`answer-list-${lang}`);
                [...(list?.querySelectorAll('.flex.items-center.gap-2') || [])].slice(4).forEach(row => row.remove());
                reindexAnswerFields(lang);
            });
            const defaultRuChecked = document.querySelector('.q-correct-toggle[data-lang="ru"][data-index="0"]');
            const defaultKkChecked = document.querySelector('.q-correct-toggle[data-lang="kk"][data-index="0"]');
            if (defaultRuChecked) defaultRuChecked.checked = true;
            if (defaultKkChecked) defaultKkChecked.checked = true;
            switchTab('questions_list');
        }
    } catch (err) {
        alert('Не удалось связаться с сервером');
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    populateCategorySelects();
    adminToken = localStorage.getItem('adminToken') || '';
    if (adminToken) {
        try {
            await adminFetch('/api/admin/results');
            showAdminApp();
            switchTab('results');
            return;
        } catch (err) {
            localStorage.removeItem('adminToken');
            adminToken = '';
        }
    }
    showLoginScreen('');
});