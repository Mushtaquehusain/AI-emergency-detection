import time
from collections import defaultdict
from typing import Optional
import numpy as np
import cv2

from app.detectors.yolo import get_detector as get_yolo_detector
from app.detectors.base import Detection


class EmergencyDetector:
    """
    Emergency detection using YOLO COCO as base with heuristic mapping.
    
    PROTOTYPE LIMITATION: This is a college MVP using heuristic approaches.
    - FIRE: Based on COCO object detection (fire-related objects)
    - ACCIDENT: Heuristic based on vehicle overlap and motion patterns
    - VIOLENCE: Heuristic based on person clustering and motion
    
    This is NOT a production emergency detection system.
    """

    def __init__(self):
        self.yolo = get_yolo_detector()
        self.model_name = f"Emergency (base: {self.yolo.model_name})"
        self.device = self.yolo.device
        
        # COCO class IDs that might indicate fire
        self.fire_related_classes = {
            "fire", "flame", "smoke", "explosion"
        }
        
        # Since COCO doesn't have explicit fire classes, we'll use color-based detection
        # as a fallback heuristic for prototype purposes
        self._init_color_thresholds()

    def _init_color_thresholds(self):
        """Initialize color thresholds for flame detection (bright orange/red/yellow)."""
        # Fire typically appears with intense saturation and high value (brightness):
        # Hue 0-20, Saturation 130-255, Value 180-255
        self.fire_lower = np.array([0, 130, 180])
        self.fire_upper = np.array([20, 255, 255])

    def _detect_fire_color(self, frame: np.ndarray) -> float:
        """
        Heuristic fire detection using flame color/intensity analysis.
        Returns confidence score (0-1) based on bright flame pixel ratio.
        """
        try:
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            mask = cv2.inRange(hsv, self.fire_lower, self.fire_upper)
            fire_pixels = np.sum(mask > 0)
            total_pixels = frame.shape[0] * frame.shape[1]
            ratio = fire_pixels / total_pixels
            
            # Require significant bright flame presence to scale confidence
            confidence = min(ratio * 15, 1.0)
            return confidence
        except Exception:
            return 0.0

    def _detect_accident_heuristic(self, detections: list[Detection], frame: np.ndarray) -> float:
        """
        Heuristic accident detection based on vehicle positioning and overlap.
        
        HEURISTIC FALLBACK: Uses IoU (Intersection over Union) between vehicles as a collision proxy.
        This is a proxy signal and not equivalent to full crash impact analysis.
        """
        try:
            # Filter for vehicle-related COCO classes
            vehicle_classes = {"car", "truck", "bus", "motorcycle", "bicycle"}
            vehicles = [d for d in detections if d.type.lower() in vehicle_classes]
            
            if len(vehicles) < 2:
                return 0.0
            
            # Calculate overlap between vehicles
            max_iou = 0.0
            for i, v1 in enumerate(vehicles):
                for v2 in vehicles[i+1:]:
                    iou = self._calculate_iou(v1.box, v2.box)
                    max_iou = max(max_iou, iou)
            
            # High overlap suggests potential collision
            confidence = min(max_iou * 2.5, 1.0)
            return confidence
        except Exception:
            return 0.0

    def _detect_violence_heuristic(self, detections: list[Detection], frame: np.ndarray) -> float:
        """
        Heuristic violence detection based on person clustering, bounding box overlap (IoU), and proximity.
        
        HEURISTIC FALLBACK: Uses person proximity and bounding box overlap as proxy signals.
        Real violence detection in production requires a temporal action recognition model.
        """
        try:
            # Filter for person detections
            persons = [d for d in detections if d.type.lower() == "person"]
            
            if len(persons) < 2:
                return 0.0
            
            # Calculate proximity and overlap between all detected persons
            min_distance = float('inf')
            max_iou = 0.0
            for i, p1 in enumerate(persons):
                for p2 in persons[i+1:]:
                    dist = self._calculate_center_distance(p1.box, p2.box)
                    min_distance = min(min_distance, dist)
                    iou = self._calculate_iou(p1.box, p2.box)
                    max_iou = max(max_iou, iou)
            
            frame_diagonal = np.sqrt(frame.shape[0]**2 + frame.shape[1]**2)
            normalized_dist = min_distance / frame_diagonal
            
            # Physical overlap (grappling / struggle proxy) or close confrontation proximity
            if max_iou >= 0.15:
                confidence = min(0.70 + max_iou * 0.5, 1.0)
            elif normalized_dist < 0.20:
                confidence = 0.70
            elif normalized_dist < 0.35:
                confidence = 0.55
            else:
                confidence = 0.0
            
            return confidence
        except Exception:
            return 0.0

    def _calculate_iou(self, box1: list[float], box2: list[float]) -> float:
        """Calculate Intersection over Union for two bounding boxes."""
        x1_1, y1_1, x2_1, y2_1 = box1
        x1_2, y1_2, x2_2, y2_2 = box2
        
        # Calculate intersection
        x1_i = max(x1_1, x1_2)
        y1_i = max(y1_1, y1_2)
        x2_i = min(x2_1, x2_2)
        y2_i = min(y2_1, y2_2)
        
        if x2_i <= x1_i or y2_i <= y1_i:
            return 0.0
        
        intersection = (x2_i - x1_i) * (y2_i - y1_i)
        
        # Calculate union
        area1 = (x2_1 - x1_1) * (y2_1 - y1_1)
        area2 = (x2_2 - x1_2) * (y2_2 - y1_2)
        union = area1 + area2 - intersection
        
        if union == 0:
            return 0.0
        
        return intersection / union

    def _calculate_center_distance(self, box1: list[float], box2: list[float]) -> float:
        """Calculate distance between centers of two bounding boxes."""
        x1_1, y1_1, x2_1, y2_1 = box1
        x1_2, y1_2, x2_2, y2_2 = box2
        
        center1_x = (x1_1 + x2_1) / 2
        center1_y = (y1_1 + y2_1) / 2
        center2_x = (x1_2 + x2_2) / 2
        center2_y = (y1_2 + y2_2) / 2
        
        return np.sqrt((center2_x - center1_x)**2 + (center2_y - center1_y)**2)

    def detect(self, frame: np.ndarray) -> tuple[list[Detection], float, dict]:
        """
        Detect emergencies in frame.
        
        Returns:
            detections: List of YOLO detections
            inference_ms: Inference time in milliseconds
            scores: Dict with fire, accident, violence confidence scores
        """
        started = time.perf_counter()
        
        # Get base YOLO detections
        detections, yolo_ms = self.yolo.detect(frame)
        
        # Calculate emergency-specific scores
        fire_score = self._detect_fire_color(frame)
        accident_score = self._detect_accident_heuristic(detections, frame)
        violence_score = self._detect_violence_heuristic(detections, frame)
        
        scores = {
            "fire": round(fire_score, 3),
            "accident": round(accident_score, 3),
            "violence": round(violence_score, 3),
        }
        
        elapsed_ms = (time.perf_counter() - started) * 1000
        
        return detections, elapsed_ms, scores


_emergency_detector: Optional[EmergencyDetector] = None


def get_detector() -> EmergencyDetector:
    global _emergency_detector
    if _emergency_detector is None:
        _emergency_detector = EmergencyDetector()
    return _emergency_detector
