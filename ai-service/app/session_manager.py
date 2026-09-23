import time
from collections import defaultdict
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass


@dataclass
class AlertConfig:
    """Configuration for emergency type detection thresholds."""
    threshold: float  # Minimum confidence to trigger
    confirmation_frames: int  # Number of consecutive frames needed
    cooldown_seconds: int  # Minimum time between alerts of same type


# Default configurations for MVP
ALERT_CONFIGS: Dict[str, AlertConfig] = {
    "FIRE": AlertConfig(threshold=0.6, confirmation_frames=3, cooldown_seconds=30),
    "ACCIDENT": AlertConfig(threshold=0.5, confirmation_frames=2, cooldown_seconds=45),
    "VIOLENCE": AlertConfig(threshold=0.5, confirmation_frames=2, cooldown_seconds=30),
}


@dataclass
class SessionState:
    """Per-session tracking state."""
    consecutive_counts: Dict[str, int]  # emergency_type -> consecutive frames
    last_alert_time: Dict[str, float]  # emergency_type -> timestamp of last alert
    frame_count: int


class SessionManager:
    """
    Manages multi-frame confirmation and cooldown for emergency detection.
    
    Tracks per-session state to reduce false positives through:
    - Multi-frame confirmation: Require N consecutive frames above threshold
    - Cooldown: Prevent duplicate alerts within time window
    """

    def __init__(self):
        self.sessions: Dict[str, SessionState] = {}

    def get_or_create_session(self, session_id: str) -> SessionState:
        """Get existing session or create new one."""
        if session_id not in self.sessions:
            self.sessions[session_id] = SessionState(
                consecutive_counts=defaultdict(int),
                last_alert_time={},
                frame_count=0
            )
        return self.sessions[session_id]

    def process_frame(
        self,
        session_id: str,
        scores: Dict[str, float]
    ) -> Tuple[List[Dict], Dict[str, int]]:
        """
        Process a frame's scores and return confirmed alerts.
        
        Args:
            session_id: Session identifier
            scores: Dict with fire, accident, violence confidence scores
            
        Returns:
            confirmed_alerts: List of confirmed emergency alerts
            consecutive_counts: Current consecutive frame counts per type
        """
        session = self.get_or_create_session(session_id)
        session.frame_count += 1
        
        confirmed_alerts = []
        current_time = time.time()
        
        for emergency_type, config in ALERT_CONFIGS.items():
            score_key = emergency_type.lower()
            score = scores.get(score_key, 0.0)
            
            # Check if score exceeds threshold
            if score >= config.threshold:
                session.consecutive_counts[emergency_type] += 1
                
                # Check if we have enough consecutive frames
                if session.consecutive_counts[emergency_type] >= config.confirmation_frames:
                    # Check cooldown
                    last_alert = session.last_alert_time.get(emergency_type, 0)
                    if current_time - last_alert >= config.cooldown_seconds:
                        # Confirm alert
                        confirmed_alerts.append({
                            "type": emergency_type,
                            "confidence": score,
                            "consecutive_frames": session.consecutive_counts[emergency_type],
                            "timestamp": current_time,
                        })
                        session.last_alert_time[emergency_type] = current_time
                        session.consecutive_counts[emergency_type] = 0  # Reset after confirmation
            else:
                # Reset consecutive count if below threshold
                session.consecutive_counts[emergency_type] = 0
        
        return confirmed_alerts, dict(session.consecutive_counts)

    def reset_session(self, session_id: str) -> None:
        """Reset session state."""
        if session_id in self.sessions:
            del self.sessions[session_id]

    def cleanup_old_sessions(self, max_age_seconds: int = 3600) -> None:
        """Remove sessions older than max_age_seconds."""
        current_time = time.time()
        to_remove = []
        
        for session_id, session in self.sessions.items():
            # Simple heuristic: if no recent activity, clean up
            # In production, track last activity timestamp
            if session.frame_count > 1000:  # Arbitrary cleanup threshold
                to_remove.append(session_id)
        
        for session_id in to_remove:
            del self.sessions[session_id]


_session_manager: Optional[SessionManager] = None


def get_session_manager() -> SessionManager:
    global _session_manager
    if _session_manager is None:
        _session_manager = SessionManager()
    return _session_manager
