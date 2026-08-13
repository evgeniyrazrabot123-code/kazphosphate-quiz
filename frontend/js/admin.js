let globalResults = [];
let adminToken = '';
const API_BASE = 'https://kazphosphate-quiz-1.onrender.com'; 

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
    return saved ? JSON.parse(saved) : DEFAULT_SPECIALTIES;
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

        if (!response.ok) throw new Error('invalid_credentials');

        const data = await response.json();
        adminToken = data.token;
        localStorage.setItem('adminToken', adminToken);
        showAdminApp();
        switchTab('results');
    } catch (err) {
        if (errorNode) {
            errorNode.innerText = 'Неверный логин или пароль.';
            errorNode.classList.remove('hidden');
        }
    }
}

// ------------------------------------------------------------------
// 2. ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК
// ------------------------------------------------------------------
function switchTab(tab) {
    const activeClass = "px-4 py-2 font-bold rounded bg-slate-900 text-white text-xs uppercase tracking-wider transition";
    const inactiveClass = "px-4 py-2 font-bold rounded text-slate-600 hover:text-slate-900 bg-white border border-slate-300 text-xs uppercase tracking-wider transition";

    ['results', 'questions-list', 'add-question', 'specialties'].forEach(t => {
        document.getElementById(`tab-${t}`)?.classList.add('hidden');
        const btn = document.getElementById(`tab-${t}-btn`);
        if (btn) btn.className = inactiveClass;
    });

    const targetTabId = tab.replace('_', '-');
    document.getElementById(`tab-${targetTabId}`)?.classList.remove('hidden');
    const targetBtn = document.getElementById(`tab-${targetTabId}-btn`);
    if (targetBtn) targetBtn.className = activeClass;

    if (tab === 'results') loadResults();
    else if (tab === 'questions_list') loadQuestionsList();
    else if (tab === 'add_question') populateCategorySelects();
    else if (tab === 'specialties') renderSpecialtiesTable();
}

// ------------------------------------------------------------------
// 3. УПРАВЛЕНИЕ СПЕЦИАЛЬНОСТЯМИ
// ------------------------------------------------------------------
function renderSpecialtiesTable() {
    // Если админ авторизован — попробуем загрузить с сервера
    const tbody = document.getElementById('specialties-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (adminToken) {
        adminFetch('/api/admin/specialties').then(r => r.json()).then(list => {
            list.forEach(s => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50 transition-colors";
                tr.innerHTML = `
                    <td class="p-3 border-r border-slate-100 font-mono text-[11px] text-slate-500">${s.code}</td>
                    <td class="p-3 border-r border-slate-100 font-bold text-slate-900">${s.name_ru}</td>
                    <td class="p-3 text-center space-x-2">
                        <button onclick="editSpecialty('${s.code}', '${s.name_ru}')" class="text-blue-600 hover:underline font-bold text-xs">Изменить</button>
                        <button onclick="deleteSpecialty('${s.code}')" class="text-red-600 hover:underline font-bold text-xs">Удалить</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }).catch(() => {
            const specs = getSpecialties();
            for (const [key, name] of Object.entries(specs)) {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50 transition-colors";
                tr.innerHTML = `
                    <td class="p-3 border-r border-slate-100 font-mono text-[11px] text-slate-500">${key}</td>
                    <td class="p-3 border-r border-slate-100 font-bold text-slate-900">${name}</td>
                    <td class="p-3 text-center space-x-2">
                        <button onclick="editSpecialty('${key}', '${name}')" class="text-blue-600 hover:underline font-bold text-xs">Изменить</button>
                        <button onclick="deleteSpecialty('${key}')" class="text-red-600 hover:underline font-bold text-xs">Удалить</button>
                    </td>
                `;
                tbody.appendChild(tr);
            }
        });
        return;
    }

    const specs = getSpecialties();
    if (!tbody) return;
    tbody.innerHTML = '';
    for (const [key, name] of Object.entries(specs)) {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition-colors";
        tr.innerHTML = `
            <td class="p-3 border-r border-slate-100 font-mono text-[11px] text-slate-500">${key}</td>
            <td class="p-3 border-r border-slate-100 font-bold text-slate-900">${name}</td>
            <td class="p-3 text-center space-x-2">
                <button onclick="editSpecialty('${key}', '${name}')" class="text-blue-600 hover:underline font-bold text-xs">Изменить</button>
                <button onclick="deleteSpecialty('${key}')" class="text-red-600 hover:underline font-bold text-xs">Удалить</button>
            </td>
        `;
        tbody.appendChild(tr);
    }
}

function saveSpecialty(e) {
    e.preventDefault();
    const keyInput = document.getElementById('spec-key');
    const nameInput = document.getElementById('spec-name');
    const oldKeyInput = document.getElementById('spec-old-key');

    const key = keyInput.value.trim().toLowerCase().replace(/\s+/g, '_');
    const name = nameInput.value.trim();
    const oldKey = oldKeyInput.value.trim();

    let specs = getSpecialties();

    if (oldKey && oldKey !== key) {
        delete specs[oldKey];
    }

    specs[key] = name;
    saveSpecialties(specs);
    // Если админ — синхронизируем одиночную запись с сервером
    if (adminToken) {
        const form = new URLSearchParams();
        form.append('code', key);
        form.append('name_ru', name);
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

function editSpecialty(key, name) {
    document.getElementById('spec-key').value = key;
    document.getElementById('spec-name').value = name;
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
    document.getElementById('spec-old-key').value = '';
    document.getElementById('spec-submit-btn').textContent = 'Добавить специальность';
}

// ------------------------------------------------------------------
// 4. ЗАГРУЗКА РЕЗУЛЬТАТОВ И БЕЙДЖИ
// ------------------------------------------------------------------
async function loadResults() {
    try {
        const response = await adminFetch('/api/admin/results');
        globalResults = await response.json();
        const tbody = document.getElementById('results-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!Array.isArray(globalResults) || globalResults.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400 font-bold">Результаты тестирования в базе данных отсутствуют</td></tr>`;
            return;
        }

        const specs = getSpecialties();
        globalResults.forEach((res, index) => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50/80 transition-colors";

            const docs = [];
            if (res.photo_user) docs.push(`<a href="${res.photo_user}" target="_blank" class="text-blue-600 hover:underline font-bold">Фото 3x4</a>`);
            if (res.photo_license) docs.push(`<a href="${res.photo_license}" target="_blank" class="text-blue-600 hover:underline font-bold">Права</a>`);
            if (res.photo_id_card) docs.push(`<a href="${res.photo_id_card}" target="_blank" class="text-blue-600 hover:underline font-bold">Уд. Машиниста</a>`);

            const docsHtml = docs.length > 0 ? docs.join(' | ') : '<span class="text-slate-400">Нет</span>';
            const prettyPosition = specs[res.position] || res.position;

            tr.innerHTML = `
                <td class="p-3 border-r border-slate-100 font-mono text-[11px] text-slate-500">${res.passed_at}</td>
                <td class="p-3 border-r border-slate-100 font-bold text-slate-900">${res.full_name}</td>
                <td class="p-3 border-r border-slate-100 text-slate-700">${prettyPosition}</td>
                <td class="p-3 border-r border-slate-100 font-extrabold ${res.score >= res.total_questions * 0.7 ? 'text-emerald-700' : 'text-red-600'}">${res.score} / ${res.total_questions}</td>
                <td class="p-3 border-r border-slate-100">${docsHtml}</td>
                <td class="p-3 text-center border-r border-slate-100">
                    <button onclick="openBadgeModal(${index})" class="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-extrabold uppercase transition text-[10px] shadow-sm">🪪 Пропуск</button>
                </td>
                <td class="p-3 text-center">
                    <button onclick="deleteResult(${res.id})" class="px-3 py-1.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-lg font-extrabold uppercase transition text-[10px] border border-red-200">Удалить</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Ошибка загрузки результатов:", err);
    }
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
        const questions = await response.json();
        const tbody = document.getElementById('questions-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (questions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Вопросы пока не добавлены</td></tr>`;
            return;
        }

        const specs = getSpecialties();
        questions.forEach(q => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 transition-colors";
            tr.innerHTML = `
                <td class="p-3 border-r border-slate-100 font-mono text-[11px] text-slate-500">${q.id}</td>
                <td class="p-3 border-r border-slate-100 font-bold text-slate-900">${specs[q.category] || q.category}</td>
                <td class="p-3 border-r border-slate-100">
                    <div class="font-bold text-slate-800 mb-0.5">${q.text_ru}</div>
                    <div class="text-slate-500 italic text-[11px]">${q.text_kk}</div>
                </td>
                <td class="p-3 border-r border-slate-100 text-slate-600 text-[11px]">${Array.isArray(q.options_ru) ? q.options_ru.join(', ') : q.options_ru}</td>
                <td class="p-3 border-r border-slate-100 text-center font-extrabold text-emerald-700">${q.correct_option_index}</td>
                <td class="p-3 text-center">
                    <button onclick="deleteQuestion(${q.id})" class="px-3 py-1.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-lg font-extrabold uppercase transition text-[10px] border border-red-200">Удалить</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Ошибка загрузки вопросов:", err);
    }
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

async function submitQuestion(e) {
    e.preventDefault();
    const category = document.getElementById('q_category')?.value.trim();
    const text_ru = document.getElementById('q_text_ru')?.value.trim();
    const text_kk = document.getElementById('q_text_kk')?.value.trim();
    const options_ru_arr = document.getElementById('q_options_ru')?.value.split(',').map(s => s.trim()).filter(Boolean);
    const options_kk_arr = document.getElementById('q_options_kk')?.value.split(',').map(s => s.trim()).filter(Boolean);
    const correct_idx = parseInt(document.getElementById('q_correct_idx')?.value, 10);

    const formData = new FormData();
    formData.append('category', category);
    formData.append('text_ru', text_ru);
    formData.append('text_kk', text_kk);
    formData.append('options_ru', JSON.stringify(options_ru_arr));
    formData.append('options_kk', JSON.stringify(options_kk_arr));
    formData.append('correct_option_index', correct_idx);

    try {
        const response = await adminFetch('/api/admin/questions', { method: 'POST', body: formData });
        const res = await response.json();
        if (res.status === 'success') {
            alert('Вопрос успешно сохранен!');
            document.getElementById('add-question-form')?.reset();
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