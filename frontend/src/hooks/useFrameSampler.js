import { useCallback, useRef, useState } from "react";

const JPEG_QUALITY = 0.7;

export function useFrameSampler({ videoRef, canvasRef, fps = 5, onFrame }) {
  const [sampling, setSampling] = useState(false);
  const samplingRef = useRef(false);
  const timerRef = useRef(null);
  const inFlightRef = useRef(false);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const captureAndSend = useCallback(async () => {
    if (!samplingRef.current || inFlightRef.current) {
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      return;
    }
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      return;
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, width, height);

    inFlightRef.current = true;
    try {
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) {
              resolve(result);
            } else {
              reject(new Error("Could not capture JPEG frame"));
            }
          },
          "image/jpeg",
          JPEG_QUALITY
        );
      });
      if (samplingRef.current && onFrameRef.current) {
        await onFrameRef.current(blob);
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [canvasRef, videoRef]);

  const stopSampling = useCallback(() => {
    samplingRef.current = false;
    setSampling(false);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startSampling = useCallback(() => {
    stopSampling();
    samplingRef.current = true;
    setSampling(true);
    const intervalMs = Math.max(200, Math.round(1000 / fps));
    captureAndSend();
    timerRef.current = window.setInterval(captureAndSend, intervalMs);
  }, [captureAndSend, fps, stopSampling]);

  return { sampling, startSampling, stopSampling };
}
