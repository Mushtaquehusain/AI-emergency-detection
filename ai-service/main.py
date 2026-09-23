from io import BytesIO

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

from app.detectors.emergency import get_detector
from app.session_manager import get_session_manager

app = FastAPI(
    title="Emergency Detection AI Service",
    description="College prototype. Stage 1.5: COCO YOLO inference only.",
    version="0.1.5",
)


@app.on_event("startup")
def load_detector():
    get_detector()


@app.get("/health")
def health():
    detector = get_detector()
    return {
        "status": "ok",
        "service": "ai-service",
        "stage": "1.5",
        "models": detector.model_name,
        "device": detector.device,
    }


def decode_jpeg_bytes(data: bytes) -> np.ndarray:
    if not data:
        raise HTTPException(status_code=400, detail="missing image")

    array = np.frombuffer(data, dtype=np.uint8)
    frame = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if frame is not None:
        return frame

    try:
        with Image.open(BytesIO(data)) as image:
            image.verify()
        with Image.open(BytesIO(data)) as image:
            image.load()
            rgb = image.convert("RGB")
            return cv2.cvtColor(np.array(rgb), cv2.COLOR_RGB2BGR)
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=400, detail="invalid image") from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail="undecodable image") from exc


@app.post("/infer")
async def infer(
    image: UploadFile | None = File(default=None),
    file: UploadFile | None = File(default=None),
    session_id: str | None = Form(default=None),
):
    upload = image or file
    if upload is None:
        raise HTTPException(status_code=400, detail="missing image")

    data = await upload.read()
    if not data:
        raise HTTPException(status_code=400, detail="missing image")

    frame = decode_jpeg_bytes(data)
    if frame is None or frame.size == 0:
        raise HTTPException(status_code=400, detail="undecodable image")

    height, width = frame.shape[:2]
    detector = get_detector()
    detections, inference_ms, scores = await run_in_threadpool(detector.detect, frame)
    
    # Process multi-frame confirmation if session_id provided
    confirmed = []
    consecutive_counts = {}
    if session_id:
        session_manager = get_session_manager()
        confirmed, consecutive_counts = session_manager.process_frame(session_id, scores)

    return {
        "ok": True,
        "image": {
            "width": int(width),
            "height": int(height),
        },
        "detections": [item.to_dict() for item in detections],
        "scores": scores,
        "confirmed": confirmed,
        "consecutive_counts": consecutive_counts,
        "session_id": session_id,
        "inference_ms": round(inference_ms, 1),
        "model": detector.model_name,
    }


@app.post("/session/reset")
async def reset_session(session_id: str | None = Form(default=None)):
    if session_id:
        session_manager = get_session_manager()
        session_manager.reset_session(session_id)
    return {
        "ok": True,
        "reset": True,
        "session_id": session_id,
        "message": "session reset",
    }


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"ok": False, "error": exc.detail},
    )
