import { RTAFrame } from "@/store/types";
import { useState, useEffect, useRef, useCallback } from "react";
import { BACKEND_URL } from "../api/backend";

const WS_URL = BACKEND_URL.replace(/^http/, "ws") + "/api/v1/rta/ws";
const RECONNECT_DELAY_MS = 3000;
 
export function useRTATelemetry() {
  const [frame, setFrame] = useState<RTAFrame | null>(null);
  const [connected, setConnected] = useState(false);
  const [streamOnline, setStreamOnline] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestFrameRef = useRef<any | null>(null);
  const frameRequestRef = useRef<number | null>(null);

  const flushLatestFrame = useCallback(() => {
    frameRequestRef.current = null;

    const nextFrame = latestFrameRef.current;
    if (!nextFrame) return;

    if (nextFrame.event === "eq_recommendation" || nextFrame.event === "eq_reset") {
      return;
    }

    if (nextFrame.event === "stream_offline") {
      setStreamOnline(false);
      return;
    }

    if (nextFrame.event !== "rta_frame") {
      return;
    }

    setStreamOnline(true);
    setFrame(nextFrame as RTAFrame);
  }, []);

  const scheduleFrameFlush = useCallback(() => {
    if (frameRequestRef.current !== null) return;

    frameRequestRef.current = requestAnimationFrame(flushLatestFrame);
  }, [flushLatestFrame]);
 
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
 
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
 
    ws.onopen = () => {
      console.log("[ElyonX] WS connected →", WS_URL);
      setConnected(true);
    };
 
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        latestFrameRef.current = data;
        scheduleFrameFlush();
      } catch (e) {
        console.warn("[ElyonX] WS parse error:", e);
      }
    };
 
    ws.onerror = (err) => {
      console.warn("[ElyonX] WS error:", err);
    };
 
    ws.onclose = () => {
      setConnected(false);
      setStreamOnline(false);
      console.log("[ElyonX] WS closed. Reconnecting in", RECONNECT_DELAY_MS, "ms…");
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
    };
  }, [scheduleFrameFlush]);
 
  useEffect(() => {
    connect();
    return () => {
      if (frameRequestRef.current !== null) {
        cancelAnimationFrame(frameRequestRef.current);
        frameRequestRef.current = null;
      }
      reconnectTimer.current && clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);
 
  return {
    frame,
    connected,
    streamOnline,
    // Convenience accessors
    rta: frame?.rta ?? null,
    spl: frame?.spl_dbfs ?? null,
    bands: frame?.bands ?? [],
    imbalance: frame?.imbalance ?? null,
    feedback: frame?.feedback ?? null,
    processingTimeMs: frame?.processing_time_ms ?? null,
  };
}
