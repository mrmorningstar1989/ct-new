"""Consent-first biometric attendance workflow.

No group photo is stored. Recognition is deliberately disabled until a vendor
with a signed data-processing agreement is configured by the controller.
"""
import hashlib
import os
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException

from ..auth import get_current_user, require_admin_or_teacher
from ..db import db
from ..models import BiometricAttendanceSuggestionRequest, BiometricAttendanceConfirmation

router = APIRouter(prefix="/api/biometrics", tags=["biometrics"])
RETENTION_DAYS = int(os.environ.get("BIOMETRIC_AUDIT_RETENTION_DAYS", "30"))


def require_enabled() -> None:
    # Keep the implementation dormant until the controller completes its
    # compliance and provider onboarding work.
    if os.environ.get("BIOMETRIC_FEATURE_ENABLED", "false").lower() != "true":
        raise HTTPException(status_code=404, detail="Recurso nÃ£o disponÃ­vel")


def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


@router.post("/attendance-suggestions")
async def request_suggestions(payload: BiometricAttendanceSuggestionRequest, user: dict = Depends(require_admin_or_teacher)):
    require_enabled()
    academy_id = user["academy_id"]
    cls = await db.classes.find_one({"id": payload.class_id, "academy_id": academy_id})
    if not cls or (user["role"] == "teacher" and cls.get("teacher_id") != user.get("linked_id")):
        raise HTTPException(status_code=404, detail="Turma nÃ£o encontrada na academia")
    if not payload.image_data_url.startswith("data:image/") or len(payload.image_data_url) > 7_000_000:
        raise HTTPException(status_code=400, detail="Envie uma foto de turma em imagem de atÃ© 5 MB")

    enrolled = await db.enrollments.find({"academy_id": academy_id, "class_id": payload.class_id, "status": "active"}, {"student_id": 1}).to_list(500)
    student_ids = [item["student_id"] for item in enrolled]
    eligible = await db.students.find({"academy_id": academy_id, "id": {"$in": student_ids}, "biometric_consent.granted": True}, {"id": 1}).to_list(500)
    if not eligible:
        raise HTTPException(status_code=400, detail="Nenhum aluno desta turma autorizou reconhecimento facial")

    # Images are processed in memory only. The audit stores its hash, never the photo.
    now = datetime.now(timezone.utc)
    job = {
        "id": str(uuid.uuid4()), "academy_id": academy_id, "class_id": payload.class_id,
        "date": payload.date, "requested_by": user["id"], "requested_at": now.isoformat(),
        "image_sha256": hashlib.sha256(payload.image_data_url.encode()).hexdigest(),
        "eligible_student_count": len(eligible), "status": "provider_not_configured",
        "suggestions": [], "expires_at": now + timedelta(days=RETENTION_DAYS),
    }
    await db.biometric_attendance_jobs.insert_one(job)
    if os.environ.get("BIOMETRIC_PROVIDER", "").lower() != "aws_rekognition":
        raise HTTPException(status_code=503, detail="Reconhecimento facial desativado: configure um provedor contratado e avaliado pela academia")
    # The integration point intentionally remains behind the provider switch. It
    # must only be enabled after a DPA, DPIA/RIPD and configured AWS account.
    raise HTTPException(status_code=501, detail="Provedor configurado, mas a integração de produção ainda requer validação contratual e técnica")


@router.delete("/students/{student_id}/consent")
async def revoke_consent(student_id: str, user: dict = Depends(get_current_user)):
    require_enabled()
    if user["role"] == "student" and user.get("linked_id") != student_id:
        raise HTTPException(status_code=403, detail="Acesso negado")
    if user["role"] not in {"student", "admin"}:
        raise HTTPException(status_code=403, detail="Acesso negado")
    result = await db.students.update_one({"id": student_id, "academy_id": user["academy_id"]}, {"$set": {"biometric_consent.granted": False, "biometric_consent.revoked_at": datetime.now(timezone.utc).isoformat()}})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Aluno nÃ£o encontrado")
    return {"ok": True, "message": "Consentimento revogado. A presenÃ§a manual continua disponÃ­vel."}


@router.get("/attendance-jobs/{job_id}")
async def get_job(job_id: str, user: dict = Depends(require_admin_or_teacher)):
    require_enabled()
    job = await db.biometric_attendance_jobs.find_one({"id": job_id, "academy_id": user["academy_id"]})
    if not job:
        raise HTTPException(status_code=404, detail="Processamento nÃ£o encontrado")
    return _clean(job)
