import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Date, Boolean
from sqlalchemy.orm import relationship

try:
    from .database import Base
except ImportError:
    from database import Base


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, index=True)
    text_ru = Column(Text)
    text_kk = Column(Text)
    options_ru = Column(Text)
    options_kk = Column(Text)
    correct_option_index = Column(Integer)


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String)
    birth_date = Column(String, nullable=True)
    position = Column(String)
    iin = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    password_hash = Column(String, nullable=True)
    citizenship = Column(String, nullable=True)
    
    photo_user_path = Column(String, nullable=True)
    photo_license_path = Column(String, nullable=True)
    photo_id_card_path = Column(String, nullable=True)

    results = relationship("TestResult", back_populates="employee")


class TestResult(Base):
    __tablename__ = "test_results"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    score = Column(Integer)
    total_questions = Column(Integer)
    passed_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_deleted = Column(Boolean, default=False)

    employee = relationship("Employee", back_populates="results")


class TestAssignment(Base):
    __tablename__ = "test_assignments"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    category = Column(String, nullable=False)
    status = Column(String, default="assigned")
    assigned_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    employee = relationship("Employee")


class PassCard(Base):
    __tablename__ = "pass_cards"

    id = Column(Integer, primary_key=True, index=True)
    pass_number = Column(String, default="000125")

    full_name = Column(String)
    iin = Column(String)
    birth_date = Column(String)
    citizenship = Column(String, default="Казахстан")
    phone = Column(String)
    position = Column(String)
    organization = Column(String, default="ТОО «КАЗФОСФАТ»")
    access_zone = Column(String, default="Карьер, ДСК, Отвалы, Бункер, Производственная площадка")

    # НОВЫЕ ПОЛЯ ИЗ МАКЕТА
    personnel_number = Column(String, nullable=True)  # Табельный №
    work_type = Column(String, nullable=True)         # Вид работ
    vehicle_info = Column(String, nullable=True)      # Транспортное средство
    issued_time = Column(String, default="08:30")      # Время выдачи

    responsible_person = Column(String, default="Ильясов Д.С.")
    category = Column(String, default="A")
    issue_date = Column(Date, default=datetime.date.today)
    expiry_date = Column(Date)
    
    photo_url = Column(String, nullable=True)


class Specialty(Base):
    __tablename__ = "specialties"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True)
    name_ru = Column(String)
    name_kk = Column(String, nullable=True)