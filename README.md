# AI-Based Smart Emergency Detection & Response System

College prototype. **Not** a real municipal emergency system.

All emergency response actions in this project are **SIMULATED**. The system must never contact police, ambulance, fire department, SMS, WhatsApp, or any real emergency API.

## Disclaimer

This repository is a student MVP for learning computer vision and a simple detect → confirm → route → dashboard pipeline. Alerts shown in the interface are for demonstration only. They do not dispatch real services and must not be treated as life-safety monitoring.

## Architecture (planned)

```text
React (Vite)  →  Express (only API the browser calls)  →  FastAPI (Python AI)
                         ↓
                      MongoDB (confirmed alerts only)
```

- **React:** webcam / local video file UI and dashboard  
- **Express:** API, simulated routing, snapshots on disk, MongoDB writes  
- **FastAPI:** OpenCV + model inference, confidence, multi-frame confirmation, cooldown  
- **MongoDB:** confirmed alert records only (not every analyzed frame)

## Emergency types (MVP)

| Type | Detection approach | Simulated route |
| --- | --- | --- |
| FIRE | Object detection if a suitable checkpoint is available; otherwise a documented baseline | FIRE DEPARTMENT |
| ACCIDENT | MVP **heuristic baseline** (not a complete accident detector) | AMBULANCE |
| VIOLENCE | Practical frame classifier or labeled proxy (no from-scratch temporal model in Stage 1) | POLICE |

Vehicle overlap / IoU, if used, is a **proxy signal** only. It is not scientifically equivalent to crash understanding.

## Current stage

**Stage 1.1:** folder structure and this README only.

No packages installed, no models downloaded, no application code, and no MongoDB / FastAPI / React configuration in this step.

## Intended layout

```text
frontend/          React + Vite (later)
backend/           Node.js + Express + Mongoose (later)
ai-service/        FastAPI + OpenCV + Ultralytics (later)
data/samples/      Demo video clips (later)
backend/data/snapshots/   Alert snapshot files (later)
```
