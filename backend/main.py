import os
import sys
import json
import shutil
import csv
import io
from pathlib import Path
from uuid import uuid4
from datetime import date, datetime
from typing import Optional

from fastapi import FastAPI, Depends, UploadFile, File, Form, Response, HTTPException, Header, status, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Boolean, Float, inspect, Integer, String, Text, DateTime, text
from sqlalchemy.orm import Session
from pydantic import BaseModel
from dateutil.relativedelta import relativedelta  # Требуется: pip install python-dateutil

# =====================================================================
# НАСТРОЙКА ПУТЕЙ
# =====================================================================
BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"
UPLOAD_DIR = BASE_DIR / "uploads"

if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

os.makedirs(UPLOAD_DIR, exist_ok=True)

# Импорт моделей и БД
try:
    from .seed_data import seed_questions
except ImportError:
    try:
        from seed_data import seed_questions
    except ImportError:
        seed_questions = None

try:
    from . import models
    from .database import engine, get_db
except ImportError:
    import models
    from database import engine, get_db

# =====================================================================
# АВТОРИЗАЦИЯ АДМИНА
# =====================================================================
ADMIN_USERNAME = 'admin'
ADMIN_PASSWORD = 'kazphosphate'
ADMIN_TOKEN = 'kazphosphate-admin-token'

def verify_admin_credentials(username: str, password: str) -> bool:
    return username == ADMIN_USERNAME and password == ADMIN_PASSWORD

def get_admin_authorization(authorization: str | None = Header(None)) -> str:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')
    token = authorization.split(' ', 1)[1].strip()
    if token != ADMIN_TOKEN:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')
    return token

# =====================================================================
# ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ И МИГРАЦИИ
# =====================================================================
def add_missing_columns(engine):
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    for table_name, table_obj in models.Base.metadata.tables.items():
        if table_name not in existing_tables:
            continue

        existing_columns = {column_info["name"] for column_info in inspector.get_columns(table_name)}
        for column in table_obj.columns:
            if column.name in existing_columns or column.primary_key:
                continue

            column_type = column.type.compile(engine.dialect)
            add_sql = f'ALTER TABLE "{table_name}" ADD COLUMN "{column.name}" {column_type} NULL'
            if column.server_default is not None:
                default_value = str(column.server_default.arg)
                add_sql = f'ALTER TABLE "{table_name}" ADD COLUMN "{column.name}" {column_type} DEFAULT {default_value} NULL'

            with engine.begin() as conn:
                conn.execute(text(add_sql))

models.Base.metadata.create_all(bind=engine)
add_missing_columns(engine)

# =====================================================================
# ИНИЦИАЛИЗАЦИЯ FASTAPI И MIDDLEWARE
# =====================================================================
app = FastAPI(title="ТОО Казфосфат - Проверка знаний")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение статических файлов (Загрузки и Фронтенд)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

if (FRONTEND_DIR / "js").exists():
    app.mount("/js", StaticFiles(directory=str(FRONTEND_DIR / "js")), name="js")
if (FRONTEND_DIR / "css").exists():
    app.mount("/css", StaticFiles(directory=str(FRONTEND_DIR / "css")), name="css")
if (FRONTEND_DIR / "images").exists():
    app.mount("/images", StaticFiles(directory=str(FRONTEND_DIR / "images")), name="images")

# =====================================================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# =====================================================================
def save_upload_file(upload_file: UploadFile | None) -> str | None:
    if not upload_file or not getattr(upload_file, "filename", None):
        return None

    file_ext = Path(upload_file.filename).suffix or ".jpg"
    file_name = f"{uuid4().hex}{file_ext}"
    file_path = UPLOAD_DIR / file_name
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
    return str(file_path).replace(str(BASE_DIR) + os.sep, "")

def safe_json_loads(val):
    if isinstance(val, (list, dict)):
        return val
    try:
        return json.loads(val)
    except Exception:
        return []

# =====================================================================
# РАЗДАЧА HTML СТРАНИЦ
# =====================================================================
@app.get("/")
async def serve_index():
    index_file = FRONTEND_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="Файл index.html не найден")
    return FileResponse(index_file)

@app.get("/admin")
async def serve_admin():
    admin_file = FRONTEND_DIR / "admin.html"
    if not admin_file.exists():
        raise HTTPException(status_code=404, detail="Файл admin.html не найден")
    return FileResponse(admin_file)

@app.get("/vid.mp4")
async def serve_video():
    video_path = FRONTEND_DIR / "vid.mp4"
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Видеофайл не найден")
    return FileResponse(video_path, media_type="video/mp4")
# =====================================================================
# API: ПОЛЬЗОВАТЕЛЬСКАЯ ЧАСТЬ
# =====================================================================
@app.get("/api/questions")
def get_questions(category: str, lang: str = "ru", db: Session = Depends(get_db)):
    questions = db.query(models.Question).filter(models.Question.category == category).all()
    
    result = []
    for q in questions:
        raw_opts = q.options_ru if lang == "ru" else q.options_kk
        options = safe_json_loads(raw_opts)
        text_content = q.text_ru if lang == "ru" else q.text_kk
        result.append({
            "id": q.id,
            "text": text_content,
            "options": options
        })
    return result

@app.post("/api/submit")
async def submit_quiz(
    full_name: str = Form(...),
    birth_date: str = Form(None),
    position: str = Form(...),
    iin: str = Form(None),
    phone: str = Form(None),
    citizenship: str = Form(None),
    answers: str = Form(...),
    photo_user: UploadFile = File(None),
    photo_license: UploadFile = File(None),
    photo_id_card: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    user_photo_path = save_upload_file(photo_user)
    lic_photo_path = save_upload_file(photo_license)
    id_card_photo_path = save_upload_file(photo_id_card)

    employee = models.Employee(
        full_name=full_name,
        birth_date=birth_date,
        position=position,
        iin=iin,
        phone=phone,
        citizenship=citizenship,
        photo_user_path=user_photo_path,
        photo_license_path=lic_photo_path,
        photo_id_card_path=id_card_photo_path,
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)

    try:
        answers_dict = json.loads(answers)
    except Exception:
        answers_dict = {}

    score = 0
    details = []

    for q_id_str, user_ans in answers_dict.items():
        q = db.query(models.Question).filter(models.Question.id == int(q_id_str)).first()
        if q:
            user_ans_idx = int(user_ans)
            opts_ru = safe_json_loads(q.options_ru)
            opts_kk = safe_json_loads(q.options_kk)
            
            is_correct = (q.correct_option_index == user_ans_idx)
            if is_correct:
                score += 1

            details.append({
                "question_id": q.id,
                "text_ru": q.text_ru,
                "text_kk": q.text_kk,
                "user_answer": user_ans_idx,
                "correct_answer": q.correct_option_index,
                "is_correct": is_correct,
                "options_ru": opts_ru,
                "options_kk": opts_kk
            })

    total = len(details)

    result = models.TestResult(
        employee_id=employee.id,
        score=score,
        total_questions=total,
    )
    db.add(result)
    db.commit()

    return {
        "status": "success", 
        "employee_id": employee.id, 
        "score": score, 
        "total": total,
        "details": details
    }

# =====================================================================
# API: АДМИН-ПАНЕЛЬ
# =====================================================================
@app.post('/api/admin/login')
def admin_login(username: str = Form(...), password: str = Form(...)):
    if not verify_admin_credentials(username, password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid credentials')
    return {'token': ADMIN_TOKEN}

@app.get("/api/admin/results")
def get_results_admin(request: Request, db: Session = Depends(get_db), admin_auth: str = Depends(get_admin_authorization)):
    results = db.query(models.TestResult).all()
    output = []
    
    for r in results:
        emp = r.employee
        
        photo_user_url = None
        photo_license_url = None
        photo_id_card_url = None

        if emp and emp.photo_user_path:
            photo_user_url = str(request.url_for('uploads', path=Path(emp.photo_user_path).name))
        if emp and emp.photo_license_path:
            photo_license_url = str(request.url_for('uploads', path=Path(emp.photo_license_path).name))
        if emp and hasattr(emp, 'photo_id_card_path') and emp.photo_id_card_path:
            photo_id_card_url = str(request.url_for('uploads', path=Path(emp.photo_id_card_path).name))
        
        output.append({
            "id": r.id,
            "passed_at": r.passed_at.strftime("%d.%m.%Y %H:%M") if r and r.passed_at else "—",
            "full_name": emp.full_name if emp else "—",
            "birth_date": emp.birth_date if emp else "—",
            "position": emp.position if emp else "—",
            "iin": getattr(emp, "iin", None),
            "phone": getattr(emp, "phone", None),
            "citizenship": getattr(emp, "citizenship", None),
            "score": r.score,
            "total_questions": r.total_questions,
            "photo_user": photo_user_url,
            "photo_license": photo_license_url,
            "photo_id_card": photo_id_card_url,
        })
        
    return output

@app.delete("/api/admin/results/{r_id}")
def delete_result(r_id: int, db: Session = Depends(get_db), admin_auth: str = Depends(get_admin_authorization)):
    res = db.query(models.TestResult).filter(models.TestResult.id == r_id).first()
    if not res:
        return {"status": "error", "message": "Результат не найден"}
    db.delete(res)
    db.commit()
    return {"status": "success"}

@app.get("/api/admin/results/export/csv")
def export_results_csv(db: Session = Depends(get_db), admin_auth: str = Depends(get_admin_authorization)):
    results = db.query(models.TestResult).all()
    
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';')
    
    writer.writerow([
        "ID", 
        "Дата и время прохождения", 
        "ФИО сотрудника", 
        "Должность", 
        "Дата рождения", 
        "Балл", 
        "Всего вопросов", 
        "Процент"
    ])
    
    for r in results:
        emp = r.employee
        pct = round((r.score / r.total_questions * 100), 1) if r.total_questions > 0 else 0
        writer.writerow([
            r.id,
            r.passed_at.strftime("%Y-%m-%d %H:%M") if r and r.passed_at else "—",
            emp.full_name if emp else "—",
            emp.position if emp else "—",
            emp.birth_date if emp else "—",
            r.score,
            r.total_questions,
            f"{pct}%"
        ])
    
    response = Response(content=output.getvalue().encode('utf-8-sig'), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=kazphosphate_results.csv"
    return response

@app.get("/api/admin/questions")
def get_all_questions_admin(db: Session = Depends(get_db), admin_auth: str = Depends(get_admin_authorization)):
    questions = db.query(models.Question).all()
    output = []
    for q in questions:
        output.append({
            "id": q.id,
            "category": q.category,
            "text_ru": q.text_ru,
            "text_kk": q.text_kk,
            "options_ru": safe_json_loads(q.options_ru),
            "options_kk": safe_json_loads(q.options_kk),
            "correct_option_index": q.correct_option_index
        })
    return output

@app.post("/api/admin/questions")
def add_question(
    category: str = Form(...),
    text_ru: str = Form(...),
    text_kk: str = Form(...),
    options_ru: str = Form(...),
    options_kk: str = Form(...),
    correct_option_index: int = Form(...),
    db: Session = Depends(get_db),
    admin_auth: str = Depends(get_admin_authorization)
):
    category_clean = category.strip()

    new_q = models.Question(
        category=category_clean,
        text_ru=text_ru.strip(),
        text_kk=text_kk.strip(),
        options_ru=options_ru,
        options_kk=options_kk,
        correct_option_index=int(correct_option_index)
    )
    db.add(new_q)
    db.commit()
    db.refresh(new_q)
    return {"status": "success", "question_id": new_q.id}

@app.delete("/api/admin/questions/{q_id}")
def delete_question(q_id: int, db: Session = Depends(get_db), admin_auth: str = Depends(get_admin_authorization)):
    q = db.query(models.Question).filter(models.Question.id == q_id).first()
    if not q:
        return {"status": "error", "message": "Вопрос не найден"}
    db.delete(q)
    db.commit()
    return {"status": "success"}

# =====================================================================
# API: КАРТЫ ДОПУСКА
# =====================================================================
def calculate_expiry_date(start_date: date, category: str) -> date:
    """
    A (Постоянный) — 1 год
    B (Временный) — 90 дней
    C (Разовый) — 1 день (24 часа)
    """
    cat = (category or "A").upper()
    if cat == 'A':
        return start_date + relativedelta(years=1)
    elif cat == 'B':
        return start_date + relativedelta(days=90)
    elif cat == 'C':
        return start_date + relativedelta(days=1)
    return start_date + relativedelta(years=1)

class PassCardUpdateSchema(BaseModel):
    full_name: Optional[str] = None
    iin: Optional[str] = None
    position: Optional[str] = None
    organization: Optional[str] = None
    personnel_number: Optional[str] = None  # Табельный №
    work_type: Optional[str] = None         # Вид работ
    access_zone: Optional[str] = None       # Разрешенная зона
    vehicle_info: Optional[str] = None      # ТС
    issued_time: Optional[str] = None       # Время выдачи
    responsible_person: Optional[str] = None
    category: Optional[str] = None
    issue_date: Optional[date] = None

@app.get("/api/passes/{pass_id}")
def get_pass_card(pass_id: int, db: Session = Depends(get_db)):
    card = db.query(models.PassCard).filter(models.PassCard.id == pass_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Пропуск не найден")
    return card

@app.put("/api/passes/{pass_id}")
def update_pass_card(
    pass_id: int, 
    data: PassCardUpdateSchema, 
    db: Session = Depends(get_db),
    admin_auth: str = Depends(get_admin_authorization)
):
    card = db.query(models.PassCard).filter(models.PassCard.id == pass_id).first()
    
    if not card:
        card = models.PassCard(id=pass_id)
        db.add(card)

    update_dict = data.dict(exclude_unset=True)
    for key, value in update_dict.items():
        if key not in ["category", "issue_date"]:
            setattr(card, key, value)

    new_category = data.category if data.category is not None else (card.category or "A")
    new_issue_date = data.issue_date if data.issue_date is not None else (card.issue_date or date.today())

    card.category = new_category
    card.issue_date = new_issue_date
    card.expiry_date = calculate_expiry_date(new_issue_date, new_category)

    db.commit()
    db.refresh(card)

    return {
        "status": "success",
        "message": "Данные пропуска обновлены",
        "card": {
            "id": card.id,
            "full_name": card.full_name,
            "position": card.position,
            "organization": card.organization,
            "personnel_number": card.personnel_number,
            "work_type": card.work_type,
            "access_zone": card.access_zone,
            "vehicle_info": card.vehicle_info,
            "issued_time": card.issued_time,
            "responsible_person": card.responsible_person,
            "category": card.category,
            "issue_date": card.issue_date.strftime("%Y-%m-%d") if card.issue_date else None,
            "expiry_date": card.expiry_date.strftime("%Y-%m-%d") if card.expiry_date else None,
        }
    }