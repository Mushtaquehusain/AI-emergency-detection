# AI-Based Smart Emergency Detection & Response System

College prototype. **Not** a real municipal emergency system.

All emergency response actions in this project are **SIMULATED**. The system must never contact police, ambulance, fire department, SMS, WhatsApp, or any real emergency API.

## Disclaimer

This repository is a student MVP for learning computer vision and a simple detect → confirm → route → dashboard pipeline. Alerts shown in the interface are for demonstration only. They do not dispatch real services and must not be treated as life-safety monitoring.

## Architecture

```text
React (Vite)  →  Express (only API the browser calls)  →  FastAPI (Python AI)
                         ↓
                      MongoDB (confirmed alerts only)
```

- **React:** Multi-camera webcam UI, Google Maps integration, alert dashboard  
- **Express:** API, simulated routing, snapshots on disk, MongoDB writes  
- **FastAPI:** OpenCV + YOLO inference, heuristic emergency detection, multi-frame confirmation, cooldown  
- **MongoDB:** confirmed alert records with camera info, locations, and action history

## Emergency Detection (MVP)

|| Type | Detection approach | Simulated route |
|| --- | --- | --- |
|| FIRE | Color-based heuristic (orange/red pixel analysis) + YOLO object detection | FIRE DEPARTMENT |
|| ACCIDENT | Vehicle detection + IoU overlap heuristic (proxy signal only) | AMBULANCE |
|| VIOLENCE | Person proximity heuristic (proxy signal only) | POLICE |

**Limitations:**
- Vehicle overlap/IoU is a proxy signal, not scientifically equivalent to crash understanding
- Person proximity is a heuristic proxy, not a real violence detection system
- These are college MVP implementations, not production emergency detection systems

## Startup Commands

### Prerequisites
- Node.js 18+
- Python 3.8+
- MongoDB Atlas account (free tier works)
- Google Maps API key (optional, for map integration)

### Backend (Express + MongoDB)
```bash
cd backend
npm install
cp .env.example .env  # Add your MONGO_URI
npm run dev
```

### AI Service (FastAPI)
```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8001
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
cp .env.example .env  # Add VITE_GOOGLE_MAPS_API_KEY (optional)
npm run dev
```

### Environment Variables

**backend/.env:**
```
MONGO_URI=mongodb+srv://your-cluster.mongodb.net/emergency-detection
PORT=4000
AI_SERVICE_URL=http://127.0.0.1:8001
```

**frontend/.env:**
```
VITE_GOOGLE_MAPS_API_KEY=your_restricted_key_here
VITE_AI_SERVICE_URL=http://127.0.0.1:8001
```

## Google Maps Setup (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable APIs:
   - Maps JavaScript API
   - Places API
4. Create API key with restrictions:
   - Application restrictions: HTTP referrers (your domain)
   - API restrictions: Only Maps JavaScript API and Places API
5. Add key to `frontend/.env` as `VITE_GOOGLE_MAPS_API_KEY`

## Camera Requirements

- Up to 3 webcams simultaneously
- Standard USB webcams or compatible phone camera apps
- Browser must have camera permissions
- Each camera can be labeled and assigned manual GPS coordinates

## Features Implemented

✅ **Multi-camera monitoring** - Up to 3 simultaneous webcams with individual controls  
✅ **One-button monitoring** - Start/Stop controls all cameras and analysis together  
✅ **Emergency detection** - FIRE, ACCIDENT, VIOLENCE with confidence scores  
✅ **Multi-frame confirmation** - Reduces false positives with consecutive frame requirements  
✅ **Cooldown mechanism** - Prevents duplicate alerts within time windows  
✅ **Google Maps integration** - Display camera locations and alert markers  
✅ **Sound alerts** - Web Audio API warning beeps for new emergencies  
✅ **Simulated emergency response** - Call Police, Ambulance, Fire Department (simulated)  
✅ **Alert dashboard** - Filter by category, camera, status; acknowledge and resolve alerts  
✅ **MongoDB persistence** - Alert history with snapshots, locations, and action tracking  
✅ **Health monitoring** - Backend and AI service status indicators  

## Testing

Run these focused tests after starting all services:

```bash
# Test backend health
curl http://localhost:4000/api/health

# Test AI service health  
curl http://127.0.0.1:8001/health

# Test alert retrieval
curl http://localhost:4000/api/alerts

# Test manual alert creation
curl -X POST http://localhost:4000/api/alerts \
  -H "Content-Type: application/json" \
  -d '{"type":"FIRE","confidence":0.8,"sessionId":"test","source":"webcam"}'
```

## Project Structure

```text
frontend/          React + Vite
├── src/
│   ├── components/    CameraGrid, EnhancedDashboard, GoogleMap
│   ├── hooks/         useFrameSampler, useSoundAlert
│   └── api/           API client
backend/           Node.js + Express + Mongoose
├── src/
│   ├── models/        Alert schema with camera/location
│   ├── routes/        API endpoints with action recording
│   └── services/      Alert processing, AI client
ai-service/        FastAPI + OpenCV + Ultralytics
├── app/
│   └── detectors/     Emergency detection, session management
data/samples/      Demo video clips
backend/data/snapshots/   Alert snapshot files
```

## Current Stage

**Stage 2.0:** Complete MVP with multi-camera support, Google Maps, sound alerts, and simulated emergency response.
