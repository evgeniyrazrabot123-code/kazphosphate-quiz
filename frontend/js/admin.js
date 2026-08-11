let globalResults = [];
let adminToken = '';
const API_BASE = ''; // Относительный путь для работы на хостинге

// Все специальности ТОО «Казфосфат»
const positionNames = {
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

// Вспомогательная функция для авторизованных запросов
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
            throw new Error('invalid_credentials');
        }

        const data = await response.json();
        adminToken = data.token;
        localStorage.setItem('adminToken', adminToken);
        showAdminApp();
        switchTab('results');
    } catch (err) {
        if (errorNode) {
            errorNode.innerText = err.message === 'invalid_credentials'
                ? 'Неверный логин или пароль. Попробуйте снова.'
                : 'Ошибка связи с сервером. Попробуйте чуть позже.';
            errorNode.classList.remove('hidden');
        }
    }
}

// ------------------------------------------------------------------
// 2. ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК В АДМИНКЕ
// ------------------------------------------------------------------
function switchTab(tab) {
    const activeClass = "px-4 py-2 font-bold rounded bg-slate-900 text-white text-xs uppercase tracking-wider";
    const inactiveClass = "px-4 py-2 font-bold rounded text-slate-600 hover:text-kpp-navy bg-white border border-kpp-border text-xs uppercase tracking-wider";

    document.getElementById('tab-results')?.classList.add('hidden');
    document.getElementById('tab-questions-list')?.classList.add('hidden');
    document.getElementById('tab-add-question')?.classList.add('hidden');

    if (document.getElementById('tab-results-btn')) document.getElementById('tab-results-btn').className = inactiveClass;
    if (document.getElementById('tab-questions-list-btn')) document.getElementById('tab-questions-list-btn').className = inactiveClass;
    if (document.getElementById('tab-add-question-btn')) document.getElementById('tab-add-question-btn').className = inactiveClass;

    if (tab === 'results') {
        document.getElementById('tab-results')?.classList.remove('hidden');
        if (document.getElementById('tab-results-btn')) document.getElementById('tab-results-btn').className = activeClass;
        loadResults();
    } else if (tab === 'questions_list') {
        document.getElementById('tab-questions-list')?.classList.remove('hidden');
        if (document.getElementById('tab-questions-list-btn')) document.getElementById('tab-questions-list-btn').className = activeClass;
        loadQuestionsList();
    } else {
        document.getElementById('tab-add-question')?.classList.remove('hidden');
        if (document.getElementById('tab-add-question-btn')) document.getElementById('tab-add-question-btn').className = activeClass;
    }
}

// ------------------------------------------------------------------
// 3. ЗАГРУЗКА, УДАЛЕНИЕ И ЭКСПОРТ РЕЗУЛЬТАТОВ
// ------------------------------------------------------------------
async function loadResults() {
    try {
        const response = await adminFetch('/api/admin/results');
        globalResults = await response.json();

        const tbody = document.getElementById('results-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (globalResults.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">Результаты пока отсутствуют</td></tr>`;
            return;
        }

        globalResults.forEach((res, index) => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50";

            const docs = [];
            if (res.photo_user) docs.push(`<a href="${res.photo_user}" target="_blank" class="text-blue-700 underline font-bold">Фото 3x4</a>`);
            if (res.photo_license) docs.push(`<a href="${res.photo_license}" target="_blank" class="text-blue-700 underline font-bold">Права</a>`);
            if (res.photo_id_card) docs.push(`<a href="${res.photo_id_card}" target="_blank" class="text-blue-700 underline font-bold">Уд. Машиниста</a>`);

            const docsHtml = docs.length > 0 ? docs.join(' | ') : '<span class="text-slate-400">Нет</span>';
            const prettyPosition = positionNames[res.position] || res.position;

            tr.innerHTML = `
                <td class="p-2.5 border-r border-slate-200 font-mono text-[11px]">${res.passed_at}</td>
                <td class="p-2.5 border-r border-slate-200 font-bold text-slate-900">${res.full_name}</td>
                <td class="p-2.5 border-r border-slate-200">${prettyPosition}</td>
                <td class="p-2.5 border-r border-slate-200 font-bold ${res.score >= res.total_questions * 0.7 ? 'text-emerald-700' : 'text-red-600'}">
                    ${res.score} / ${res.total_questions}
                </td>
                <td class="p-2.5 border-r border-slate-200">${docsHtml}</td>
                <td class="p-2.5 text-center border-r border-slate-200">
                    <button onclick="openBadgeModal(${index})" class="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold uppercase transition text-[10px]">
                        🪪 Пропуск
                    </button>
                </td>
                <td class="p-2.5 text-center">
                    <button onclick="deleteResult(${res.id})" class="px-2.5 py-1 bg-red-100 hover:bg-red-600 text-red-700 hover:text-white rounded font-bold uppercase transition text-[10px]">
                        Удалить
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Ошибка загрузки результатов:", err);
    }
}

async function deleteResult(id) {
    if (!confirm("Вы уверены, что хотите полностью удалить этот результат из базы данных?")) return;

    try {
        const response = await adminFetch(`/api/admin/results/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadResults();
        } else {
            const errData = await response.json();
            alert("Ошибка при удалении: " + (errData.detail || errData.message || "Не удалось удалить"));
        }
    } catch (err) {
        console.error("Ошибка удаления:", err);
        alert('Ошибка связи с сервером при попытке удаления');
    }
}

async function exportResultsCSV() {
    try {
        const response = await adminFetch('/api/admin/results/export/csv');
        if (!response.ok) throw new Error('Ошибка при скачивании файла');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kazphosphate_results_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        console.error("Ошибка экспорта CSV:", err);
        alert('Не удалось выгрузить данные. Проверьте авторизацию или связь с сервером.');
    }
}

// ------------------------------------------------------------------
// 4. УПРАВЛЕНИЕ КАРТОЙ ДОПУСКА (БЕЙДЖИ)
// ------------------------------------------------------------------
function openBadgeModal(index) {
    const res = globalResults[index];
    if (!res) return;

    document.getElementById('editPassId').value = res.id;
    document.getElementById('editFullName').value = res.full_name || '';
    document.getElementById('editIin').value = res.iin || '';
    document.getElementById('editPosition').value = positionNames[res.position] || res.position || '';
    document.getElementById('editOrganization').value = 'ТОО «КАЗФОСФАТ»';

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('editIssueDate').value = today;
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

    if (category === 'A') {
        endDate.setFullYear(endDate.getFullYear() + 1);
    } else if (category === 'B') {
        endDate.setMonth(endDate.getMonth() + 6); // 6 месяцев
    } else if (category === 'C') {
        endDate.setDate(endDate.getDate() + 1);   // 24 часа
    }

    previewElem.innerText = endDate.toLocaleDateString('ru-RU');
}

async function savePassCard(e) {
    e.preventDefault();

    const passId = document.getElementById('editPassId').value;
    const payload = {
        full_name: document.getElementById('editFullName').value,
        iin: document.getElementById('editIin').value,
        position: document.getElementById('editPosition').value,
        organization: document.getElementById('editOrganization').value,
        category: document.getElementById('editCategory').value,
        issue_date: document.getElementById('editIssueDate').value
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
            showFinalBadge(data.card, passId);
        } else {
            alert('Ошибка сохранения: ' + (data.detail || 'Не удалось обновить'));
        }
    } catch (err) {
        console.error(err);
        alert('Ошибка связи с сервером');
    }
}

function showFinalBadge(card, passId) {
    const res = globalResults.find(r => r.id == passId) || {};
    const badgeNum = String(card.id || passId).padStart(6, '0');

    const issueDate = card.issue_date ? new Date(card.issue_date) : new Date();
    const expiryDate = card.expiry_date ? new Date(card.expiry_date) : new Date();

    if (document.getElementById('badge-num')) document.getElementById('badge-num').innerText = badgeNum;
    if (document.getElementById('badge-fio')) document.getElementById('badge-fio').innerText = card.full_name || res.full_name || '—';
    if (document.getElementById('badge-pos')) document.getElementById('badge-pos').innerText = card.position || positionNames[res.position] || res.position || '—';
    if (document.getElementById('badge-organization')) document.getElementById('badge-organization').innerText = card.organization || 'ТОО «КАЗФОСФАТ»';

    if (document.getElementById('badge-dates')) {
        document.getElementById('badge-dates').innerHTML = `С ${issueDate.toLocaleDateString('ru-RU')}<br>ПО ${expiryDate.toLocaleDateString('ru-RU')}`;
    }

    const catTitle = document.getElementById('badge-category-title');
    const catSub = document.getElementById('badge-category-sub');

    if (catTitle && catSub) {
        if (card.category === 'B') {
            catTitle.innerText = 'B';
            catTitle.className = 'font-black text-3xl text-amber-600 block my-0.5';
            catSub.innerText = 'ВРЕМЕННЫЙ';
        } else if (card.category === 'C') {
            catTitle.innerText = 'C';
            catTitle.className = 'font-black text-3xl text-blue-600 block my-0.5';
            catSub.innerText = 'РАЗОВЫЙ';
        } else {
            catTitle.innerText = 'A';
            catTitle.className = 'font-black text-3xl text-emerald-800 block my-0.5';
            catSub.innerText = 'ПОСТОЯННЫЙ';
        }
    }

    const photoElem = document.getElementById('badge-photo');
    if (photoElem) {
        photoElem.src = res.photo_user || `https://ui-avatars.com/api/?name=${encodeURIComponent(card.full_name || 'K')}&background=000&color=fff&size=200`;
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

        questions.forEach(q => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50";

            tr.innerHTML = `
                <td class="p-2.5 border-r border-slate-200 font-mono text-[11px] text-slate-500">${q.id}</td>
                <td class="p-2.5 border-r border-slate-200 font-bold text-slate-900">${positionNames[q.category] || q.category}</td>
                <td class="p-2.5 border-r border-slate-200">
                    <div class="font-bold text-slate-800 mb-0.5">${q.text_ru}</div>
                    <div class="text-slate-500 italic text-[11px]">${q.text_kk}</div>
                </td>
                <td class="p-2.5 border-r border-slate-200 text-slate-600">
                    ${Array.isArray(q.options_ru) ? q.options_ru.join(', ') : q.options_ru}
                </td>
                <td class="p-2.5 border-r border-slate-200 text-center font-bold text-emerald-700">
                    Индекс: ${q.correct_option_index}
                </td>
                <td class="p-2.5 text-center">
                    <button onclick="deleteQuestion(${q.id})" class="px-2.5 py-1 bg-red-100 hover:bg-red-600 text-red-700 hover:text-white rounded font-bold uppercase transition text-[10px]">
                        Удалить
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Ошибка загрузки вопросов:", err);
    }
}

async function deleteQuestion(id) {
    if (!confirm("Удалить этот вопрос из базы данных?")) return;

    try {
        const response = await adminFetch(`/api/admin/questions/${id}`, {
            method: 'DELETE'
        });
        const res = await response.json();
        if (res.status === 'success') {
            loadQuestionsList();
        }
    } catch (err) {
        alert('Ошибка связи с сервером');
    }
}

async function submitQuestion(e) {
    e.preventDefault();

    const category = document.getElementById('q_category').value.trim();
    const text_ru = document.getElementById('q_text_ru').value.trim();
    const text_kk = document.getElementById('q_text_kk').value.trim();
    
    const options_ru_arr = document.getElementById('q_options_ru').value
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    const options_kk_arr = document.getElementById('q_options_kk').value
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    
    const correct_idx = parseInt(document.getElementById('q_correct_idx').value, 10);

    const formData = new FormData();
    formData.append('category', category);
    formData.append('text_ru', text_ru);
    formData.append('text_kk', text_kk);
    formData.append('options_ru', JSON.stringify(options_ru_arr));
    formData.append('options_kk', JSON.stringify(options_kk_arr));
    formData.append('correct_option_index', correct_idx);

    try {
        const response = await adminFetch('/api/admin/questions', {
            method: 'POST',
            body: formData
        });

        const res = await response.json();
        if (res.status === 'success') {
            alert('Вопрос успешно сохранен в базу данных!');
            document.getElementById('add-question-form').reset();
            switchTab('questions_list');
        }
    } catch (err) {
        alert('Не удалось связаться с сервером');
    }
}

// ------------------------------------------------------------------
// 6. ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
// ------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
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