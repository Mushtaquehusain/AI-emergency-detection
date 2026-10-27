import { useCallback, useEffect, useRef, useState } from "react";

// Configurable high-pitch traditional examination bell characteristics
const BELL_FREQUENCY = 2100; // 1800 - 2500 Hz
const BELL_VOLUME = 0.2; // Clean, comfortable audible level
const STRIKE_INTERVAL_MS = 140; // Fast repetitive mechanical bell strike (examination bell ring)
const STRIKE_DURATION_S = 0.09; // Rapid strike envelope duration

export function useSoundAlert({ monitoring = true } = {}) {
  const [muted, setMuted] = useState(false);
  const [activeAlert, setActiveAlert] = useState(null);
  const [isAlarming, setIsAlarming] = useState(false);

  const mutedRef = useRef(false);
  const isAlarmingRef = useRef(false);
  const activeAlertRef = useRef(null);
  const audioContextRef = useRef(null);
  const masterGainRef = useRef(null);
  const strikeTimerRef = useRef(null);
  const activeNodesRef = useRef(new Set());
  const acknowledgedAlertsRef = useRef(new Set());

  // Keep mutedRef in sync and adjust master gain without creating extra audio loops
  useEffect(() => {
    mutedRef.current = muted;
    if (masterGainRef.current && audioContextRef.current) {
      try {
        const targetGain = muted ? 0 : BELL_VOLUME;
        masterGainRef.current.gain.setValueAtTime(
          targetGain,
          audioContextRef.current.currentTime
        );
      } catch (_) {}
    }
  }, [muted]);

  // AudioContext initialization & unlocking for autoplay restrictions
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      const ctx = new AudioCtx();
      const master = ctx.createGain();
      master.gain.setValueAtTime(mutedRef.current ? 0 : BELL_VOLUME, ctx.currentTime);
      master.connect(ctx.destination);
      audioContextRef.current = ctx;
      masterGainRef.current = master;
    }
    if (audioContextRef.current && audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume().catch(() => {});
    }
    return audioContextRef.current;
  }, []);

  // Unlock audio on user interaction
  useEffect(() => {
    const handleGesture = () => {
      getAudioContext();
    };
    window.addEventListener("click", handleGesture, { passive: true });
    window.addEventListener("keydown", handleGesture, { passive: true });
    return () => {
      window.removeEventListener("click", handleGesture);
      window.removeEventListener("keydown", handleGesture);
    };
  }, [getAudioContext]);

  // Play a single high-pitched metallic strike (examination bell strike)
  const strikeBell = useCallback(() => {
    if (!isAlarmingRef.current) return;
    const ctx = getAudioContext();
    if (!ctx || !masterGainRef.current) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const strikeGain = ctx.createGain();

      // Triangle wave provides crisp metallic bell timbre at ~2100 Hz
      osc.type = "triangle";
      osc.frequency.setValueAtTime(BELL_FREQUENCY, now);

      // Sharp strike attack and rapid exponential decay
      strikeGain.gain.setValueAtTime(0.001, now);
      strikeGain.gain.exponentialRampToValueAtTime(1.0, now + 0.005);
      strikeGain.gain.exponentialRampToValueAtTime(0.001, now + STRIKE_DURATION_S);

      osc.connect(strikeGain);
      strikeGain.connect(masterGainRef.current);

      const nodePair = { osc, strikeGain };
      activeNodesRef.current.add(nodePair);

      osc.start(now);
      osc.stop(now + STRIKE_DURATION_S);

      osc.onended = () => {
        try {
          osc.disconnect();
          strikeGain.disconnect();
        } catch (_) {}
        activeNodesRef.current.delete(nodePair);
      };
    } catch (err) {
      console.warn("Bell strike error:", err);
    }
  }, [getAudioContext]);

  // Stop active oscillators and interval timer immediately
  const stopAllAudioNodes = useCallback(() => {
    if (strikeTimerRef.current) {
      clearInterval(strikeTimerRef.current);
      strikeTimerRef.current = null;
    }
    activeNodesRef.current.forEach(({ osc, strikeGain }) => {
      try {
        osc.stop();
        osc.disconnect();
        strikeGain.disconnect();
      } catch (_) {}
    });
    activeNodesRef.current.clear();
  }, []);

  // Stop sound / silence alarm completely
  const stopSound = useCallback(() => {
    isAlarmingRef.current = false;
    setIsAlarming(false);
    stopAllAudioNodes();
    if (activeAlertRef.current) {
      acknowledgedAlertsRef.current.add(activeAlertRef.current);
      activeAlertRef.current = null;
      setActiveAlert(null);
    }
  }, [stopAllAudioNodes]);

  // Acknowledge alert and stop alarm immediately
  const acknowledgeAlert = useCallback((alertId) => {
    if (alertId) {
      acknowledgedAlertsRef.current.add(alertId);
    }
    stopSound();
  }, [stopSound]);

  // Start continuous examination bell alarm for a new confirmed alert
  const playAlertSound = useCallback((alertId) => {
    if (!alertId || acknowledgedAlertsRef.current.has(alertId)) {
      return;
    }

    activeAlertRef.current = alertId;
    setActiveAlert(alertId);

    // Prevent duplicate timers if already alarming
    if (isAlarmingRef.current) {
      return;
    }

    isAlarmingRef.current = true;
    setIsAlarming(true);

    getAudioContext();

    // Strike immediately, then ring continuously at repeating interval
    strikeBell();
    if (!strikeTimerRef.current) {
      strikeTimerRef.current = setInterval(strikeBell, STRIKE_INTERVAL_MS);
    }
  }, [getAudioContext, strikeBell]);

  // Toggle mute without creating additional timers or loops
  const toggleMute = useCallback(() => {
    setMuted((prev) => !prev);
  }, []);

  // When monitoring stops, immediately stop all oscillators and repeating loops
  useEffect(() => {
    if (!monitoring && isAlarmingRef.current) {
      stopSound();
    }
  }, [monitoring, stopSound]);

  // Complete cleanup on unmount
  const cleanup = useCallback(() => {
    isAlarmingRef.current = false;
    setIsAlarming(false);
    stopAllAudioNodes();
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (_) {}
      audioContextRef.current = null;
      masterGainRef.current = null;
    }
    acknowledgedAlertsRef.current.clear();
  }, [stopAllAudioNodes]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    muted,
    activeAlert,
    isAlarming,
    playAlertSound,
    stopSound,
    acknowledgeAlert,
    toggleMute,
    cleanup,
  };
}
