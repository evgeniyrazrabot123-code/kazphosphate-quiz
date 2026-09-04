let currentLang = 'ru';
let loadedQuestions = [];
let isSubmitting = false; // Блокировка от повторных кликов и дублей
const TEST_DURATION_MS = 30 * 60 * 1000;
let quizTimerInterval = null;
let quizDeadline = null;
let employeeCabinetCredentials = null;

// Дефолтные специальности ТОО «Казфосфат»
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

const DEFAULT_SPECIALTIES_KK = {
    'dumper': 'Карьерлік самосвал жүргізушісі',
    'car_driver': 'Жеңіл автомобиль жүргізушісі',
    'truck_driver': 'Жүк автомобилі жүргізушісі',
    'bus_driver': 'Автобус жүргізушісі',
    'trailer_driver': 'Тіркемесі бар автомобиль жүргізушісі',
    'fuel_driver': 'Жанармай құятын жүргізуші',
    'dopog_driver': 'Қауіпті жүк тасымалдаушы жүргізуші (ДОПОГ)',
    'excavator': 'Экскаватор машинисі',
    'loader': 'Фронтальды погрузчик машинисі',
    'bulldozer': 'Бульдозер машинисі',
    'grader': 'Автогрейдер машинисі',
    'roller': 'Жол катогының машинисі',
    'telehandler': 'Телескопиялық погрузчик машинисі',
    'drilling_rig': 'Бұрғылау қондырғысының машинисі',
    'operator': 'Технологиялық жабдық операторы',
    'auto_mechanic': 'Автомобиль жөндеу слесары',
    'machinery_mechanic': 'Өздігінен жүретін техниканы жөндеу слесары',
    'mechanic': 'Учаске механигі',
    'foreman': 'Учаске шебері',
    'other': 'Басқа лауазым'
};

function translateSpecialtiesToKazakh(specs) {
    const translated = {};
    for (const [key, value] of Object.entries(specs || {})) {
        translated[key] = DEFAULT_SPECIALTIES_KK[key] || value || DEFAULT_SPECIALTIES[key] || key;
    }
    return translated;
}

// Динамическое получение специальностей из localStorage (синхронизация с админкой)
function getSpecialties(lang = currentLang) {
    const saved = localStorage.getItem('kpp_specialties');
    const savedKk = localStorage.getItem('kpp_specialties_kk');

    if (!saved) {
        return lang === 'kk' ? DEFAULT_SPECIALTIES_KK : DEFAULT_SPECIALTIES;
    }

    try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            if (lang === 'kk') {
                const kkParsed = savedKk ? JSON.parse(savedKk) : {};
                const translated = {};
                for (const [key, value] of Object.entries(parsed)) {
                    translated[key] = kkParsed[key] || DEFAULT_SPECIALTIES_KK[key] || value;
                }
                return translated;
            }
            return parsed;
        }
    } catch (e) {
        console.warn('getSpecialties parse error', e);
    }

    return lang === 'kk' ? DEFAULT_SPECIALTIES_KK : DEFAULT_SPECIALTIES;
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

const translations = {
    ru: {
        step1: 'Данные сотрудника',
        step2: 'Тестирование',
        step3: 'Результат',
        instrTag: 'ИНСТРУКТАЖ ПО ТЕСТИРОВАНИЮ ПЕРСОНАЛА',
        instrTitle: 'Цель и порядок проведения тестирования',
        instrDesc: 'Настоящая проверка предназначена для подтверждения уровня профессиональной подготовки, допусков к работе на объектах повышенной опасности и знаний требований охраны труда ТОО «Казфосфат».',
        sec1Title: '01. ДАННЫЕ СОТРУДНИКА',
        lblFio: 'ФАМИЛИЯ, ИМЯ, ОТЧЕСТВО (ПОЛНОСТЬЮ)',
        lblPhone: 'КОНТАКТНЫЙ ТЕЛЕФОН',
        lblBirth: 'ДАТА РОЖДЕНИЯ',
        lblCitizenship: 'ГРАЖДАНСТВО',
        lblPos: 'СПЕЦИАЛЬНОСТЬ / ДОЛЖНОСТЬ',
        btnNext: 'ПЕРЕЙТИ К ТЕСТИРОВАНИЮ →',
        sec2Title: '02. ПРОВЕРКА ПРОФЕССИОНАЛЬНЫХ ЗНАНИЙ',
        btnBack: '← НАЗАД',
        btnSubmit: 'ПОДТВЕРДИТЬ И ОТПРАВИТЬ РЕЗУЛЬТАТЫ',
        resTitle: 'Тестирование успешно пройдено',
        resDesc: 'Данные зарегистрированы в протоколе квалификационной комиссии ТОО «Казфосфат».',
        btnRestart: 'Завершить сессию',
        sendingText: 'ОТПРАВКА...',
        licenseTitle: 'ВОДИТЕЛЬСКОЕ УДОСТОВЕРЕНИЕ',
        licenseCategoryLabel: 'КАТЕГОРИИ',
        licenseFileLabel: 'Загрузить водительское удостоверение',
        idcardTitle: 'УДОСТОВЕРЕНИЕ МАШИНИСТА',
        idcardCategoryLabel: 'КАТЕГОРИЯ',
        idcardNumberLabel: 'НОМЕР',
        idcardFileLabel: 'Загрузить удостоверение машиниста',
        photoTitle: 'ФОТО СОТРУДНИКА (3x4)',
        photoDescription: 'Сделайте селфи на камеру или загрузите фото из галереи — анфас, без головного убора, при хорошем освещении.',
        photoCameraBtn: 'Сделать фото',
        photoGalleryBtn: 'Из галереи'
    },
    kk: {
        step1: 'Қызметкер деректері',
        step2: 'Тестирование',
        step3: 'Нәтиже',
        instrTag: 'ПЕРСОНАЛДЫ ТЕСТИРОВАНИЕ БОЙЫНША НҰСҚАУЛЫҚ',
        instrTitle: 'Тестирлеудің мақсаты мен өткізу тәртібі',
        instrDesc: 'Бұл тексеру кәсіби дайындық деңгейін, қауіптілігі жоғары объектілерде жұмыс істеуге рұқсаттарды және «Қазфосфат» ЖШС еңбекті қорғау талаптарының білімін растауға арналған.',
        sec1Title: '01. ҚЫЗМЕТКЕРДІҢ МӘЛІМЕТТЕРІ',
        lblFio: 'ТЕГІ, АТЫ, ӘКЕСІНІҢ АТЫ (ТОЛЫҚ)',
        lblPhone: 'БАЙЛАНЫС ТЕЛЕФОНЫ',
        lblBirth: 'ТУҒАН КҮНІ',
        lblCitizenship: 'АЗАМАТТЫҒЫ',
        lblPos: 'МАМАНДЫҒЫ / ЛАУАЗЫМЫ',
        btnNext: 'ТЕСТКЕ ӨТУ →',
        sec2Title: '02. КӘСІБИ БІЛІМДІ ТЕКСЕРУ',
        btnBack: '← АРТҚА',
        btnSubmit: 'РАСТАУ ЖӘНЕ НӘТИЖЕНІ ЖІБЕРУ',
        resTitle: 'Тестирование сәтті өтті',
        resDesc: 'Мәліметтер «Қазфосфат» ЖШС біліктілік комиссиясының хаттамасында тіркелді.',
        btnRestart: 'Сессияны аяқтау',
        sendingText: 'ЖІБЕРІЛУДЕ...',
        licenseTitle: 'ЖҮРГІЗУШІ КУӘЛІГІ',
        licenseCategoryLabel: 'САНАТТАР',
        licenseFileLabel: 'Жүргізуші куәлігінің сканерін жүктеу',
        idcardTitle: 'МАШИНИСТ КУӘЛІГІ',
        idcardCategoryLabel: 'САНАТ',
        idcardNumberLabel: 'НОМЕР',
        idcardFileLabel: 'Куәліктің сканерін жүктеу',
        photoTitle: 'ҚЫЗМЕТКЕРДІҢ ФОТОСЫ (3x4)',
        photoDescription: 'Камерадан автопортрет алыңыз немесе галереядан фото жүктеңіз — анфас, бастың қақпағысыз, жақсы жарықта.',
        photoCameraBtn: 'Фотосурет алу',
        photoGalleryBtn: 'Галереядан'
    }
};

// Заполнение селекта должностей на главной странице
function populatePositionsList() {
    const selectElem = document.getElementById('position');
    if (!selectElem) return;

    const selectedValue = selectElem.value;
    selectElem.innerHTML = '';

    const API_BASE = 'https://kazphosphate-quiz-1.onrender.com';
    fetch(`${API_BASE}/api/specialties?lang=${currentLang}`).then(r => r.ok ? r.json() : Promise.reject()).then(specs => {
        for (const [key, name] of Object.entries(specs || {})) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = name;
            if (selectedValue && selectedValue === key) option.selected = true;
            selectElem.appendChild(option);
        }
        if (!selectedValue && selectElem.options.length > 0) {
            selectElem.selectedIndex = 0;
        }
    }).catch(() => {
        const specs = getSpecialties(currentLang);
        for (const [key, name] of Object.entries(specs)) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = name;
            if (selectedValue && selectedValue === key) option.selected = true;
            selectElem.appendChild(option);
        }
    });
}

// Автообновление списка специальностей каждые 15 секунд
window.addEventListener('load', () => {
    populatePositionsList();
    setInterval(populatePositionsList, 15000);
});

// ЧИСТАЯ ФУНКЦИЯ ПЕРЕМЕШИВАНИЯ (Алгоритм Фишера-Йейтса)
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
    }
    return arr;
}

// МУЛЬТИЯЗЫЧНОСТЬ
function setLanguage(lang) {
    currentLang = lang;
    const t = translations[lang];
    if (!t) return;

    document.documentElement.lang = lang;

    const applyText = (id, value) => {
        const node = document.getElementById(id);
        if (node && value) node.textContent = value;
    };

    applyText('step-lbl-1', t.step1);
    applyText('step-lbl-2', t.step2);
    applyText('step-lbl-3', t.step3);
    applyText('instr-tag', t.instrTag);
    applyText('instr-title', t.instrTitle);
    applyText('instr-desc', t.instrDesc);
    applyText('sec1-title', t.sec1Title);
    applyText('lbl-fio', t.lblFio);
    applyText('lbl-phone', t.lblPhone);
    applyText('lbl-birth', t.lblBirth);
    applyText('lbl-citizenship', t.lblCitizenship);
    applyText('lbl-pos', t.lblPos);
    applyText('btn-next', t.btnNext);
    applyText('sec2-title', t.sec2Title);
    applyText('btn-back', t.btnBack);
    applyText('btn-submit', t.btnSubmit);
    applyText('res-title', t.resTitle);
    applyText('res-desc', t.resDesc);
    applyText('btn-restart', t.btnRestart);
    applyText('license-title', t.licenseTitle);
    applyText('license-category-label', t.licenseCategoryLabel);
    applyText('license-file-label', t.licenseFileLabel);
    applyText('idcard-title', t.idcardTitle);
    applyText('idcard-category-label', t.idcardCategoryLabel);
    applyText('idcard-number-label', t.idcardNumberLabel);
    applyText('idcard-file-label', t.idcardFileLabel);
    applyText('photo-title', t.photoTitle);
    applyText('photo-description', t.photoDescription);
    applyText('photo-camera-btn', t.photoCameraBtn);
    applyText('photo-gallery-btn', t.photoGalleryBtn);

    const btnRu = document.getElementById('btn-ru');
    const btnKk = document.getElementById('btn-kk');
    if (btnRu && btnKk) {
        btnRu.className = lang === 'ru'
            ? 'px-3 py-1 text-xs font-bold rounded-md bg-[#0F1E36] text-white transition-all'
            : 'px-3 py-1 text-xs font-bold rounded-md text-slate-500 hover:text-slate-900 transition-all';
        btnKk.className = lang === 'kk'
            ? 'px-3 py-1 text-xs font-bold rounded-md bg-[#0F1E36] text-white transition-all'
            : 'px-3 py-1 text-xs font-bold rounded-md text-slate-500 hover:text-slate-900 transition-all';
    }

    populatePositionsList();

    if (document.getElementById('step-2') && !document.getElementById('step-2').classList.contains('hidden')) {
        loadQuestions();
    }
}

// ВАЛИДАЦИЯ
async function goToStep2(skipDocuments = false) {
    const fullName = document.getElementById('full_name')?.value.trim();
    const phone = document.getElementById('phone')?.value.trim();
    const birthDate = document.getElementById('birth_date')?.value;

    if (!fullName) {
        alert(currentLang === 'ru' ? 'Пожалуйста, введите ФИО полностью!' : 'Өтініш, Т.А.Ә. толық енгізіңіз!');
        document.getElementById('full_name')?.focus();
        return;
    }

    if (!phone || phone.length < 7) {
        alert(currentLang === 'ru' ? 'Введите корректный номер телефона!' : 'Телефон нөмірін дұрыс енгізіңіз!');
        document.getElementById('phone')?.focus();
        return;
    }

    if (!birthDate) {
        alert(currentLang === 'ru' ? 'Пожалуйста, укажите дату рождения!' : 'Өтініш, туған күніңізді көрсетіңіз!');
        document.getElementById('birth_date')?.focus();
        return;
    }

    const photoElem = document.getElementById('photo_user');
    const licenseElem = document.getElementById('photo_license');
    const idcardElem = document.getElementById('photo_id_card');

    const hasPhoto = photoElem && photoElem.files && photoElem.files.length > 0;
    const hasLicense = licenseElem && licenseElem.files && licenseElem.files.length > 0;
    const hasIdCard = idcardElem && idcardElem.files && idcardElem.files.length > 0;
    const hasAnyDocument = hasLicense || hasIdCard;

    if (!skipDocuments && (!hasPhoto || !hasAnyDocument)) {
        const msgs = [];
        if (!hasPhoto) msgs.push(currentLang === 'ru' ? 'Фото 3x4' : '3x4 фотосурет');
        if (!hasAnyDocument) msgs.push(currentLang === 'ru' ? 'хотя бы один документ' : 'кемінде бір құжат');

        const errMsg = currentLang === 'ru'
            ? `Пожалуйста, загрузите: ${msgs.join(', ')} перед началом тестирования.`
            : `Өтініш, мына файлдарды жүктеңіз: ${msgs.join(', ')} тестілеуді бастамас бұрын.`;

        alert(errMsg);

        if (!hasPhoto) {
            const photoBlock = document.getElementById('photo-block');
            const photoError = document.getElementById('photo-error');
            if (photoBlock) photoBlock.classList.add('input-error');
            if (photoError) { photoError.innerText = currentLang === 'ru' ? 'Пожалуйста, загрузите фото 3x4.' : '3x4 фотосуретті жүктеңіз.'; photoError.classList.remove('hidden'); }
        }
        if (!hasAnyDocument) {
            const licenseBlock = document.getElementById('license-block');
            const licenseError = document.getElementById('license-error');
            const idcardBlock = document.getElementById('idcard-block');
            const idcardError = document.getElementById('idcard-error');
            if (licenseBlock) licenseBlock.classList.add('input-error');
            if (idcardBlock) idcardBlock.classList.add('input-error');
            if (licenseError) {
                licenseError.innerText = currentLang === 'ru'
                    ? 'Пожалуйста, загрузите хотя бы один документ: водительское удостоверение или удостоверение машиниста.'
                    : 'Өтініш, кемінде бір құжат жүктеңіз: жүргізуші куәлігі немесе машинист куәлігі.';
                licenseError.classList.remove('hidden');
            }
            if (idcardError) {
                idcardError.innerText = currentLang === 'ru'
                    ? 'Пожалуйста, загрузите хотя бы один документ: водительское удостоверение или удостоверение машиниста.'
                    : 'Өтініш, кемінде бір құжат жүктеңіз: жүргізуші куәлігі немесе машинист куәлігі.';
                idcardError.classList.remove('hidden');
            }
        }

        if (!hasPhoto && photoElem) { photoElem.scrollIntoView({ behavior: 'smooth', block: 'center' }); photoElem.focus(); }
        else if (!hasAnyDocument) {
            if (licenseElem) licenseElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        return;
    }

    const loaded = await loadQuestions();

    if (loaded) {
        document.getElementById('step-1').classList.add('hidden');
        document.getElementById('step-2').classList.remove('hidden');
        startQuizTimer();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function formatTimer(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateQuizTimer() {
    const timerNode = document.getElementById('quiz-timer');
    if (!timerNode || !quizDeadline) return;

    const remaining = quizDeadline - Date.now();
    if (remaining <= 0) {
        timerNode.innerText = '00:00';
        if (quizTimerInterval) {
            clearInterval(quizTimerInterval);
            quizTimerInterval = null;
        }
        if (!isSubmitting) {
            alert(currentLang === 'ru' ? 'Время тестирования закончилось. Тест закрыт автоматически.' : 'Тест уақыты аяқталды. Тест автоматты түрде жабылды.');
            handleFormSubmit(null, true);
        }
        return;
    }

    timerNode.innerText = formatTimer(remaining);
}

function startQuizTimer() {
    if (quizTimerInterval) {
        clearInterval(quizTimerInterval);
    }

    quizDeadline = Date.now() + TEST_DURATION_MS;
    updateQuizTimer();
    quizTimerInterval = window.setInterval(updateQuizTimer, 1000);
}

// Remove photo error hint when a photo is selected
['photo_user', 'photo_user_camera'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
        const photoBlock = document.getElementById('photo-block');
        const photoError = document.getElementById('photo-error');
        if (photoBlock) photoBlock.classList.remove('input-error');
        if (photoError) photoError.classList.add('hidden');
    });
});

// Clear license/idcard error on change
['photo_license', 'photo_id_card'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', (e) => {
        if (id === 'photo_license') {
            const licenseBlock = document.getElementById('license-block');
            const licenseError = document.getElementById('license-error');
            if (licenseBlock) licenseBlock.classList.remove('input-error');
            if (licenseError) licenseError.classList.add('hidden');
        }
        if (id === 'photo_id_card') {
            const idcardBlock = document.getElementById('idcard-block');
            const idcardError = document.getElementById('idcard-error');
            if (idcardBlock) idcardBlock.classList.remove('input-error');
            if (idcardError) idcardError.classList.add('hidden');
        }
    });
});

// Copy camera-captured file into the gallery input so the same file is submitted
function copyCameraToGallery(inputEl) {
    try {
        const f = inputEl.files && inputEl.files[0];
        if (!f) return;
        const dt = new DataTransfer();
        dt.items.add(f);
        const gallery = document.getElementById('photo_user');
        if (gallery) {
            gallery.files = dt.files;
            // trigger change so UI removes errors
            const ev = new Event('change', { bubbles: true });
            gallery.dispatchEvent(ev);
        }
    } catch (e) {
        console.warn('copyCameraToGallery failed', e);
    }
}

function goToStep1() {
    document.getElementById('step-2').classList.add('hidden');
    document.getElementById('step-1').classList.remove('hidden');
    if (quizTimerInterval) {
        clearInterval(quizTimerInterval);
        quizTimerInterval = null;
    }
    quizDeadline = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleEmployeeCabinet() {
    document.getElementById('employee-cabinet')?.classList.toggle('hidden');
    document.getElementById('employee-cabinet')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openCabinetMode(mode) {
    const cabinet = document.getElementById('employee-cabinet');
    const registerForm = document.getElementById('employee-register-form');
    const loginForm = document.getElementById('employee-login-form');
    const toggle = document.getElementById('cabinet-mode-toggle');
    const content = document.getElementById('cabinet-content');
    cabinet?.classList.remove('hidden');
    content?.classList.add('hidden');
    registerForm?.classList.toggle('hidden', mode !== 'register');
    loginForm?.classList.toggle('hidden', mode !== 'login');
    toggle?.classList.remove('hidden');
    if (toggle) toggle.textContent = mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже зарегистрированы? Войти';
    cabinet?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function logoutEmployee() {
    employeeCabinetCredentials = null;
    document.getElementById('cabinet-content')?.classList.add('hidden');
    document.getElementById('employee-login-form')?.classList.remove('hidden');
    document.getElementById('cabinet-error')?.classList.add('hidden');
    document.getElementById('employee-register-form')?.classList.remove('hidden');
    document.getElementById('cabinet-mode-toggle').textContent = 'Уже зарегистрированы? Войти';
    document.getElementById('cabinet-mode-toggle')?.classList.remove('hidden');
}

function toggleCabinetMode() {
    const registerForm = document.getElementById('employee-register-form');
    const loginForm = document.getElementById('employee-login-form');
    const toggle = document.getElementById('cabinet-mode-toggle');
    const showingLogin = !loginForm?.classList.contains('hidden');
    registerForm?.classList.toggle('hidden', showingLogin);
    loginForm?.classList.toggle('hidden', !showingLogin);
    if (toggle) toggle.textContent = showingLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже зарегистрированы? Войти';
}

async function registerEmployee(event) {
    event.preventDefault();
    const phone = document.getElementById('register-phone')?.value.trim();
    const password = document.getElementById('register-password')?.value;
    const errorNode = document.getElementById('cabinet-error');
    try {
        const body = new URLSearchParams({ phone, password });
        const response = await fetch('/api/employee/register', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
        if (!response.ok) throw new Error((await response.json()).detail || 'Не удалось зарегистрироваться');
        employeeCabinetCredentials = { phone, password };
        await loadEmployeeCabinet();
        document.getElementById('employee-register-form')?.classList.add('hidden');
        document.getElementById('cabinet-mode-toggle')?.classList.add('hidden');
        errorNode?.classList.add('hidden');
    } catch (error) {
        if (errorNode) { errorNode.textContent = error.message; errorNode.classList.remove('hidden'); }
    }
}

async function loginEmployee(event) {
    event.preventDefault();
    const phone = document.getElementById('cabinet-phone')?.value.trim();
    const password = document.getElementById('cabinet-password')?.value;
    const errorNode = document.getElementById('cabinet-error');
    try {
        const body = new URLSearchParams({ phone, password });
        const response = await fetch('/api/employee/login', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
        if (!response.ok) throw new Error((await response.json()).detail || 'Сотрудник не найден');
        employeeCabinetCredentials = { phone, password };
        await loadEmployeeCabinet();
        document.getElementById('employee-login-form')?.classList.add('hidden');
        errorNode?.classList.add('hidden');
    } catch (error) {
        if (errorNode) {
            errorNode.textContent = error.message;
            errorNode.classList.remove('hidden');
        }
    }
}

async function loadEmployeeCabinet() {
    if (!employeeCabinetCredentials) return;
    const { phone, password } = employeeCabinetCredentials;
    const body = new URLSearchParams({ phone, password });
    const response = await fetch('/api/employee/cabinet', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if (!response.ok) throw new Error('Не удалось загрузить кабинет');
    const data = await response.json();

    document.getElementById('cabinet-name').textContent = data.employee.full_name || '—';
    document.getElementById('cabinet-position').textContent = getSpecialties()[data.employee.position] || data.employee.position || 'Профиль не заполнен';
    document.getElementById('profile-full-name').value = data.employee.full_name || '';
    document.getElementById('profile-birth-date').value = data.employee.birth_date || '';
    populateProfilePositions(data.employee.position);
    const assignmentsNode = document.getElementById('cabinet-assignments');
    const assignments = data.assignments || [];
    const firstTestAvailable = !data.results?.length && data.employee.full_name && data.employee.birth_date && data.employee.position;
    const firstTestCard = firstTestAvailable ? `
        <div class="border border-emerald-200 bg-emerald-50 rounded-xl p-3 flex items-center justify-between gap-3">
            <div><p class="font-bold text-slate-900">Первичное тестирование</p><p class="text-[10px] text-slate-500">Доступно сразу после регистрации</p></div>
            <button type="button" onclick="startAssignedTest('${data.employee.position}')" class="px-3 py-2 rounded-md bg-emerald-700 text-white text-[10px] font-extrabold uppercase">Пройти тест</button>
        </div>` : '';
    assignmentsNode.innerHTML = firstTestCard + (assignments.length ? assignments.map(assignment => `
        <div class="border border-amber-200 bg-amber-50 rounded-xl p-3 flex items-center justify-between gap-3">
            <div><p class="font-bold text-slate-900">Тест по специальности</p><p class="text-[10px] text-slate-500">Назначен: ${assignment.assigned_at}</p></div>
            ${assignment.status === 'assigned' ? `<button type="button" onclick="startAssignedTest('${assignment.category}')" class="px-3 py-2 rounded-md bg-kpp-red text-white text-[10px] font-extrabold uppercase">Пройти</button>` : '<span class="text-[10px] font-bold text-emerald-700">Выполнен</span>'}
        </div>`).join('') : (firstTestCard ? '' : '<p class="text-xs text-slate-500">Новых назначений пока нет.</p>'));

    const resultsNode = document.getElementById('cabinet-results');
    const results = data.results || [];
    resultsNode.innerHTML = results.length ? results.map(result => `
        <div class="flex items-center justify-between gap-3 border-b border-slate-100 py-2">
            <div><p class="font-bold text-slate-800">${result.passed_at}</p><p class="text-[10px] text-slate-500">Результат тестирования</p></div>
            <div class="text-right"><p class="font-extrabold ${result.passed ? 'text-emerald-700' : 'text-red-700'}">${result.score} / ${result.total_questions}</p><p class="text-[10px] font-bold ${result.passed ? 'text-emerald-700' : 'text-red-700'}">${result.passed ? 'ПРОЙДЕН' : 'НЕ ПРОЙДЕН'}</p></div>
        </div>`).join('') : '<p class="text-xs text-slate-500">История результатов пока пуста.</p>';
    document.getElementById('cabinet-content')?.classList.remove('hidden');
}

function populateProfilePositions(selectedValue = '') {
    const select = document.getElementById('profile-position');
    if (!select) return;
    const specialties = getSpecialties();
    select.innerHTML = Object.entries(specialties).map(([code, name]) => `<option value="${code}">${name}</option>`).join('');
    select.value = selectedValue || Object.keys(specialties)[0] || '';
}

async function saveEmployeeProfile(event) {
    event.preventDefault();
    if (!employeeCabinetCredentials) return;
    const body = new URLSearchParams({
        phone: employeeCabinetCredentials.phone,
        password: employeeCabinetCredentials.password,
        full_name: document.getElementById('profile-full-name').value.trim(),
        birth_date: document.getElementById('profile-birth-date').value,
        position: document.getElementById('profile-position').value
    });
    try {
        const response = await fetch('/api/employee/profile', { method: 'PUT', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
        if (!response.ok) throw new Error((await response.json()).detail || 'Не удалось сохранить профиль');
        await loadEmployeeCabinet();
        alert('Профиль сохранён.');
    } catch (error) {
        const errorNode = document.getElementById('cabinet-error');
        if (errorNode) { errorNode.textContent = error.message; errorNode.classList.remove('hidden'); }
    }
}

async function startAssignedTest(category) {
    const position = document.getElementById('position');
    if (position) position.value = category;
    document.getElementById('employee-cabinet')?.classList.add('hidden');
    document.getElementById('quiz-main')?.classList.remove('hidden');
    document.getElementById('quiz-form')?.classList.remove('hidden');
    document.getElementById('video-instruction-block')?.classList.remove('hidden');
    const profileName = document.getElementById('profile-full-name')?.value.trim();
    const profileBirthDate = document.getElementById('profile-birth-date')?.value;
    if (!profileName || !profileBirthDate) {
        alert('Сначала заполните и сохраните профиль сотрудника.');
        document.getElementById('employee-profile-form')?.scrollIntoView({ behavior: 'smooth' });
        return;
    }
    document.getElementById('full_name').value = profileName;
    document.getElementById('phone').value = employeeCabinetCredentials.phone;
    document.getElementById('birth_date').value = profileBirthDate;
    await goToStep2(true);
}

// ЗАГРУЗКА ВОПРОСОВ
async function loadQuestions() {
    const category = document.getElementById('position').value;
    const container = document.getElementById('questions-container');
    const errorContainer = document.getElementById('questions-error');

    container.innerHTML = '';
    if (errorContainer) {
        errorContainer.innerText = '';
        errorContainer.classList.add('hidden');
    }

    try {
        const response = await fetch(`/api/questions?category=${category}&lang=${currentLang}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const rawQuestions = await response.json();
        if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) throw new Error('Вопросы не найдены');

        loadedQuestions = shuffleArray(rawQuestions);

        loadedQuestions.forEach((q, idx) => {
            const qBox = document.createElement('div');
            qBox.className = "question-card p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3";
            qBox.setAttribute('data-id', q.id);

            const cleanText = q.text.replace(/^\[\d+\/\d+\]\s*/, '');

            let indexedOptions = q.options.map((optText, origIndex) => ({
                text: optText,
                originalIndex: origIndex
            }));
            
            indexedOptions = shuffleArray(indexedOptions);

            let optionsHtml = '';
            indexedOptions.forEach((optObj) => {
                const radioId = `q_${q.id}_opt_${optObj.originalIndex}`;
                optionsHtml += `
                    <div>
                        <input type="radio" id="${radioId}" name="q_${q.id}" value="${optObj.originalIndex}" class="hidden custom-radio">
                        <label for="${radioId}" class="flex items-center p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-white transition-all bg-white text-xs">
                            <span class="w-4 h-4 rounded-full border border-slate-400 flex items-center justify-center mr-3 shrink-0 dot-outer">
                                <span class="w-2 h-2 rounded-full dot-inner scale-0 transition-transform"></span>
                            </span>
                            <span class="font-medium text-slate-800">${optObj.text}</span>
                        </label>
                    </div>
                `;
            });

            qBox.innerHTML = `
                <p class="font-bold text-slate-900 text-xs sm:text-sm"><span class="text-kpp-red mr-1.5">${idx + 1}.</span>${cleanText}</p>
                <div class="space-y-2">${optionsHtml}</div>
            `;
            container.appendChild(qBox);
        });

        return true;
    } catch (err) {
        console.error('Ошибка загрузки вопросов:', err);
        if (errorContainer) {
            errorContainer.innerText = currentLang === 'ru' ? 'Не удалось загрузить вопросы.' : 'Сұрақтарды жүктеу мүмкін болмады.';
            errorContainer.classList.remove('hidden');
        }
        return false;
    }
}

// ОТПРАВКА ФОРМЫ
async function handleFormSubmit(e, forceTimeout = false) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    if (isSubmitting) return;

    if (quizTimerInterval) {
        clearInterval(quizTimerInterval);
        quizTimerInterval = null;
    }
    quizDeadline = null;

    const submitBtn = document.getElementById('btn-submit');
    const originalBtnText = submitBtn ? submitBtn.innerText : 'ОТПРАВИТЬ';

    const userAnswers = {};
    const cards = document.querySelectorAll('.question-card');

    cards.forEach(card => {
        const qId = card.getAttribute('data-id');
        const selected = card.querySelector(`input[name="q_${qId}"]:checked`);
        if (selected) {
            userAnswers[qId] = parseInt(selected.value, 10);
        }
    });

    if (!forceTimeout && Object.keys(userAnswers).length < cards.length) {
        alert(currentLang === 'ru' ? "Пожалуйста, ответьте на все вопросы!" : "Өтініш, барлық сұрақтарға жауап беріңіз!");
        if (quizTimerInterval) {
            clearInterval(quizTimerInterval);
            quizTimerInterval = null;
        }
        quizDeadline = Date.now() + TEST_DURATION_MS;
        updateQuizTimer();
        quizTimerInterval = setInterval(updateQuizTimer, 1000);
        return;
    }

    isSubmitting = true;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = translations[currentLang]?.sendingText || 'Отправка...';
    }

    try {
        const formData = new FormData();
        formData.append('full_name', document.getElementById('full_name')?.value.trim() || '');
        formData.append('birth_date', document.getElementById('birth_date')?.value || '');
        formData.append('position', document.getElementById('position')?.value || '');
        formData.append('iin', document.getElementById('iin')?.value?.trim() || '');
        formData.append('phone', document.getElementById('phone')?.value.trim() || '');
        if (employeeCabinetCredentials?.password) {
            formData.append('employee_password', employeeCabinetCredentials.password);
        }

        const userPhoto = document.getElementById('photo_user')?.files[0];
        if (userPhoto) formData.append('photo_user', userPhoto);

        const licPhoto = document.getElementById('photo_license')?.files[0];
        if (licPhoto) formData.append('photo_license', licPhoto);

        const idCardPhoto = document.getElementById('photo_id_card')?.files[0];
        if (idCardPhoto) formData.append('photo_id_card', idCardPhoto);

        formData.append('answers', JSON.stringify(userAnswers));

        const response = await fetch('/api/submit', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);

        const result = await response.json();

        if (result.status === 'success') {
            document.getElementById('quiz-form')?.classList.add('hidden');
            document.getElementById('video-instruction-block')?.classList.add('hidden');

            const scoreBox = document.getElementById('score-box');
            if (scoreBox) scoreBox.innerText = `${result.score} / ${result.total}`;

            const detailsContainer = document.getElementById('results-details-container');
            if (detailsContainer) {
                detailsContainer.innerHTML = '';
                if (result.details && result.details.length > 0) {
                    result.details.forEach((item, index) => {
                        const qRawText = currentLang === 'ru' ? item.text_ru : item.text_kk;
                        const qText = qRawText.replace(/^\[\d+\/\d+\]\s*/, '');
                        const options = currentLang === 'ru' ? item.options_ru : item.options_kk;
                        
                        const userAnsText = options[item.user_answer] !== undefined ? options[item.user_answer] : '—';
                        const correctAnsText = options[item.correct_answer] !== undefined ? options[item.correct_answer] : '—';

                        const card = document.createElement('div');
                        card.className = item.is_correct
                            ? "p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/60 text-xs space-y-1.5 text-left"
                            : "p-3.5 rounded-lg border border-red-200 bg-red-50/60 text-xs space-y-1.5 text-left";

                        const badge = item.is_correct
                            ? `<span class="px-2 py-0.5 bg-emerald-700 text-white font-bold rounded text-[10px] uppercase shrink-0">Верно</span>`
                            : `<span class="px-2 py-0.5 bg-kpp-red text-white font-bold rounded text-[10px] uppercase shrink-0">Ошибка</span>`;

                        card.innerHTML = `
                            <div class="flex justify-between items-start gap-2">
                                <p class="font-bold text-slate-900"><span class="mr-1">${index + 1}.</span>${qText}</p>
                                ${badge}
                            </div>
                            <div class="text-[11px] space-y-0.5 pt-1.5 border-t border-slate-200/60">
                                <p class="${item.is_correct ? 'text-emerald-900' : 'text-red-900 font-semibold'}"><strong>Ваш ответ:</strong> ${userAnsText}</p>
                                ${!item.is_correct ? `<p class="text-emerald-800 font-semibold"><strong>Правильный ответ:</strong> ${correctAnsText}</p>` : ''}
                            </div>
                        `;
                        detailsContainer.appendChild(card);
                    });
                }
            }

            document.getElementById('result-screen')?.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    } catch (err) {
        console.error("Ошибка при отправке:", err);
        alert('Не удалось отправить анкету. Проверьте соединение с сервером.');
    } finally {
        isSubmitting = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = originalBtnText;
        }
    }
}

// ИНИЦИАЛИЗАЦИЯ
document.addEventListener('DOMContentLoaded', () => {
    setLanguage(currentLang);
    populatePositionsList();

    const quizForm = document.getElementById('quiz-form');
    const nextButton = document.getElementById('btn-next');

    if (quizForm) {
        quizForm.removeEventListener('submit', handleFormSubmit);
        quizForm.addEventListener('submit', handleFormSubmit);
    }

    if (nextButton) {
        nextButton.removeAttribute('onclick');
        nextButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            goToStep2();
        });
    }

    ['photo_user', 'photo_license', 'photo_id_card'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('change', (e) => {
                const parent = e.target.closest('div');
                if (e.target.files.length > 0) {
                    parent.classList.add('bg-emerald-50', 'border-emerald-500');
                    parent.classList.remove('bg-white', 'bg-slate-50', 'border-slate-200', 'border-blue-200', 'border-red-200');
                }
            });
        }
    });
});