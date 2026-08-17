"""Pydantic models for the API layer."""
from typing import Optional, List, Any
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict


# ---------------- Auth ----------------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "student"


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    academy_id: Optional[str] = None
    linked_id: Optional[str] = None


# ---------------- Student ----------------
class EmergencyContact(BaseModel):
    name: str = ""
    relationship: str = ""
    phone: str = ""


class StudentCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    full_name: str
    social_name: Optional[str] = None
    cpf: Optional[str] = None
    rg: Optional[str] = None
    birth_date: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    photo_url: Optional[str] = None
    address: Optional[str] = None
    zip_code: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    status: str = "active"
    emergency_contact: Optional[EmergencyContact] = None
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    notes: Optional[str] = None
    create_login: bool = True
    password: Optional[str] = None


class StudentUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    full_name: Optional[str] = None
    social_name: Optional[str] = None
    cpf: Optional[str] = None
    rg: Optional[str] = None
    birth_date: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    photo_url: Optional[str] = None
    address: Optional[str] = None
    zip_code: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    status: Optional[str] = None
    emergency_contact: Optional[EmergencyContact] = None
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    notes: Optional[str] = None


class StudentPasswordReset(BaseModel):
    model_config = ConfigDict(extra="ignore")
    password: str
    email: Optional[str] = None  # required if student has no login yet


# ---------------- Teacher ----------------
class TeacherCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    cpf: Optional[str] = None
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    specialties: List[str] = []
    status: str = "active"
    create_login: bool = True
    password: Optional[str] = None


class TeacherUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    cpf: Optional[str] = None
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    specialties: Optional[List[str]] = None
    status: Optional[str] = None


# ---------------- Modality ----------------
class BeltLevel(BaseModel):
    order: int
    name: str
    color: str = "#FFFFFF"


class ModalityCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    description: Optional[str] = None
    status: str = "active"
    min_age: Optional[int] = None
    max_age: Optional[int] = None
    belt_system: List[BeltLevel] = []


class ModalityUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    min_age: Optional[int] = None
    max_age: Optional[int] = None
    belt_system: Optional[List[BeltLevel]] = None


# ---------------- Class (Turma) ----------------
class ClassCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    modality_id: str
    teacher_id: Optional[str] = None
    weekdays: List[str] = []  # ["mon","wed"]
    start_time: str = "18:00"
    end_time: str = "19:00"
    capacity: int = 30
    min_age: Optional[int] = None
    max_age: Optional[int] = None
    level: Optional[str] = None
    status: str = "active"


class ClassUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = None
    modality_id: Optional[str] = None
    teacher_id: Optional[str] = None
    weekdays: Optional[List[str]] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    capacity: Optional[int] = None
    min_age: Optional[int] = None
    max_age: Optional[int] = None
    level: Optional[str] = None
    status: Optional[str] = None


# ---------------- Enrollment ----------------
class EnrollmentCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    student_id: str
    modality_id: str
    class_id: Optional[str] = None
    plan_id: Optional[str] = None
    custom_discount: float = 0
    start_date: Optional[str] = None
    status: str = "active"
    notes: Optional[str] = None


class EnrollmentUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    modality_id: Optional[str] = None
    class_id: Optional[str] = None
    plan_id: Optional[str] = None
    custom_discount: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class BulkEnrollRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    student_ids: List[str]
    modality_id: str
    class_id: str
    plan_id: Optional[str] = None
    custom_discount: float = 0


# ---------------- Plan ----------------
class PlanCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    value: float
    early_value: Optional[float] = None
    periodicity: str = "monthly"  # monthly, quarterly, yearly, single
    classes_per_week: int = 0
    description: Optional[str] = None
    status: str = "active"


class PlanUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = None
    value: Optional[float] = None
    early_value: Optional[float] = None
    periodicity: Optional[str] = None
    classes_per_week: Optional[int] = None
    description: Optional[str] = None
    status: Optional[str] = None


# ---------------- Invoice / Mensalidade ----------------
class InvoiceCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    student_id: str
    enrollment_id: Optional[str] = None
    plan_id: Optional[str] = None
    competency: str  # "2026-02"
    due_date: str  # ISO date
    value: float
    discount: float = 0
    notes: Optional[str] = None


class PaymentRegister(BaseModel):
    model_config = ConfigDict(extra="ignore")
    paid_at: Optional[str] = None
    payment_method: str = "pix"
    amount_paid: Optional[float] = None
    notes: Optional[str] = None


# ---------------- Attendance ----------------
class AttendanceRecord(BaseModel):
    student_id: str
    status: str  # present, absent, justified, trial, medical


class AttendanceCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    class_id: str
    date: str  # ISO date
    records: List[AttendanceRecord]


# ---------------- Graduation ----------------
class GraduationCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    student_id: str
    modality_id: str
    belt_order: int
    belt_name: str
    belt_color: str = "#FFFFFF"
    stripes: int = 0
    graduation_date: str
    teacher_id: Optional[str] = None
    notes: Optional[str] = None


# ---------------- Announcement ----------------
class AnnouncementCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: str
    message: str
    audience: str = "all"  # all, students, teachers
