from dataclasses import dataclass, asdict


@dataclass
class Detection:
    type: str
    confidence: float
    box: list[float]

    def to_dict(self) -> dict:
        return {
            "type": self.type,
            "confidence": round(self.confidence, 4),
            "box": [round(v, 1) for v in self.box],
        }
