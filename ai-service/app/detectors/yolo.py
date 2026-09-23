from pathlib import Path
import time

from ultralytics import YOLO

from app.detectors.base import Detection

MODELS_DIR = Path(__file__).resolve().parents[2] / "models"
DEFAULT_WEIGHTS = "yolo26n.pt"
IMGSZ = 640
CONF = 0.25


class YoloDetector:
    """Model-agnostic wrapper around a lightweight Ultralytics detect model."""

    def __init__(self, weights_name: str = DEFAULT_WEIGHTS, device: str = "cpu"):
        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        self.weights_path = MODELS_DIR / weights_name
        self.device = device
        self.model_name = weights_name
        self.model = YOLO(str(self.weights_path))
        self.loaded = True

    def detect(self, frame) -> tuple[list[Detection], float]:
        started = time.perf_counter()
        results = self.model.predict(
            source=frame,
            imgsz=IMGSZ,
            conf=CONF,
            device=self.device,
            verbose=False,
        )
        elapsed_ms = (time.perf_counter() - started) * 1000
        detections: list[Detection] = []
        if not results:
            return detections, elapsed_ms

        result = results[0]
        names = result.names or {}
        boxes = result.boxes
        if boxes is None:
            return detections, elapsed_ms

        xyxy = boxes.xyxy.cpu().tolist()
        confs = boxes.conf.cpu().tolist()
        classes = boxes.cls.cpu().tolist()
        for box, conf, cls_id in zip(xyxy, confs, classes):
            detections.append(
                Detection(
                    type=str(names.get(int(cls_id), str(int(cls_id)))),
                    confidence=float(conf),
                    box=[float(box[0]), float(box[1]), float(box[2]), float(box[3])],
                )
            )
        return detections, elapsed_ms


_detector: YoloDetector | None = None


def get_detector() -> YoloDetector:
    global _detector
    if _detector is None:
        _detector = YoloDetector()
    return _detector
