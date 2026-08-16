let currentLang = 'ru';
let loadedQuestions = [];
let isSubmitting = false; // Блокировка от повторных кликов и дублей

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

// Динамическое получение специальностей из localStorage (синхронизация с админкой)
function getSpecialties() {
    const saved = localStorage.getItem('kpp_specialties');
    return saved ? JSON.parse(saved) : DEFAULT_SPECIALTIES;
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
        sendingText: 'ОТПРАВКА...'
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
        sendingText: 'ЖІБЕРІЛУДЕ...'
    }
};

// Заполнение селекта должностей на главной странице
function populatePositionsList() {
    const selectElem = document.getElementById('position');
    if (!selectElem) return;

    selectElem.innerHTML = '';

    // Попытка загрузить специальности с сервера, если API доступен
    const API_BASE = 'https://kazphosphate-quiz-1.onrender.com';
    fetch(`${API_BASE}/api/specialties`).then(r => r.ok ? r.json() : Promise.reject()).then(specs => {
        for (const [key, name] of Object.entries(specs)) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = name;
            selectElem.appendChild(option);
        }
    }).catch(() => {
        const specs = getSpecialties();
        for (const [key, name] of Object.entries(specs)) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = name;
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

    if (document.getElementById('step-lbl-1')) document.getElementById('step-lbl-1').innerText = t.step1;
    if (document.getElementById('step-lbl-2')) document.getElementById('step-lbl-2').innerText = t.step2;
    if (document.getElementById('step-lbl-3')) document.getElementById('step-lbl-3').innerText = t.step3;
    if (document.getElementById('instr-tag')) document.getElementById('instr-tag').innerText = t.instrTag;
    if (document.getElementById('instr-title')) document.getElementById('instr-title').innerText = t.instrTitle;
    if (document.getElementById('instr-desc')) document.getElementById('instr-desc').innerText = t.instrDesc;
    if (document.getElementById('sec1-title')) document.getElementById('sec1-title').innerText = t.sec1Title;
    if (document.getElementById('lbl-fio')) document.getElementById('lbl-fio').innerText = t.lblFio;
    if (document.getElementById('lbl-phone')) document.getElementById('lbl-phone').innerText = t.lblPhone;
    if (document.getElementById('lbl-birth')) document.getElementById('lbl-birth').innerText = t.lblBirth;
    if (document.getElementById('lbl-citizenship')) document.getElementById('lbl-citizenship').innerText = t.lblCitizenship;
    if (document.getElementById('lbl-pos')) document.getElementById('lbl-pos').innerText = t.lblPos;
    if (document.getElementById('btn-next')) document.getElementById('btn-next').innerText = t.btnNext;
    if (document.getElementById('sec2-title')) document.getElementById('sec2-title').innerText = t.sec2Title;
    if (document.getElementById('btn-back')) document.getElementById('btn-back').innerText = t.btnBack;
    if (document.getElementById('btn-submit')) document.getElementById('btn-submit').innerText = t.btnSubmit;
    if (document.getElementById('res-title')) document.getElementById('res-title').innerText = t.resTitle;
    if (document.getElementById('res-desc')) document.getElementById('res-desc').innerText = t.resDesc;
    if (document.getElementById('btn-restart')) document.getElementById('btn-restart').innerText = t.btnRestart;

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

    if (document.getElementById('step-2') && !document.getElementById('step-2').classList.contains('hidden')) {
        loadQuestions();
    }
}

// ВАЛИДАЦИЯ
async function goToStep2() {
    const fullName = document.getElementById('full_name')?.value.trim();
    const phone = document.getElementById('phone')?.value.trim();
    const birthDate = document.getElementById('birth_date')?.value;
    const citizenship = document.getElementById('citizenship')?.value.trim();

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

    if (!citizenship) {
        alert(currentLang === 'ru' ? 'Пожалуйста, укажите ваше гражданство!' : 'Өтініш, азаматтығыңызды көрсетіңіз!');
        document.getElementById('citizenship')?.focus();
        return;
    }

    // Require a 3x4 photo before proceeding to testing
    const photoElem = document.getElementById('photo_user');
    const hasPhoto = photoElem && photoElem.files && photoElem.files.length > 0;
    if (!hasPhoto) {
        const errMsg = currentLang === 'ru'
            ? 'Пожалуйста, сделайте фото 3x4 или загрузите из галереи перед началом тестирования.'
            : 'Өтініш, тестілеуді бастамас бұрын 3x4 фотосуретті түсіріңіз немесе галереядан жүктеңіз.';
        alert(errMsg);
        // visual hint
        const photoBlock = document.getElementById('photo-block');
        const photoError = document.getElementById('photo-error');
        if (photoBlock) photoBlock.classList.add('input-error');
        if (photoError) {
            photoError.innerText = errMsg;
            photoError.classList.remove('hidden');
        }
        // try to focus the photo input
        if (photoElem) {
            photoElem.focus();
            photoElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }

    const loaded = await loadQuestions();

    if (loaded) {
        document.getElementById('step-1').classList.add('hidden');
        document.getElementById('step-2').classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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

function goToStep1() {
    document.getElementById('step-2').classList.add('hidden');
    document.getElementById('step-1').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
async function handleFormSubmit(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    if (isSubmitting) return;

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

    if (Object.keys(userAnswers).length < cards.length) {
        alert(currentLang === 'ru' ? "Пожалуйста, ответьте на все вопросы!" : "Өтініш, барлық сұрақтарға жауап беріңіз!");
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
        formData.append('citizenship', document.getElementById('citizenship')?.value.trim() || '');

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
    populatePositionsList(); // Заполняем специальности из localStorage при загрузке

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