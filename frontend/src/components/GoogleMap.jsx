import { useEffect, useRef, useState } from "react";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export default function GoogleMap({ alerts, onMarkerClick }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setError("Google Maps API key not configured");
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => {
      setLoaded(true);
      initMap();
    };
    script.onerror = () => {
      setError("Failed to load Google Maps");
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  function initMap() {
    if (!mapRef.current || !window.google) return;

    const defaultLocation = { lat: 40.7128, lng: -74.0060 }; // Default to NYC
    
    mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
      center: defaultLocation,
      zoom: 13,
      streetViewControl: false,
      fullscreenControl: false,
    });

    updateMarkers();
  }

  function updateMarkers() {
    if (!mapInstanceRef.current || !window.google) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    // Add markers for alerts with locations
    alerts.forEach((alert) => {
      if (alert.location?.lat && alert.location?.lng) {
        const marker = new window.google.maps.Marker({
          position: { lat: alert.location.lat, lng: alert.location.lng },
          map: mapInstanceRef.current,
          title: `${alert.type} - ${alert.cameraLabel || "Unknown Camera"}`,
        });

        marker.addListener("click", () => {
          onMarkerClick(alert);
        });

        markersRef.current.push(marker);
      }
    });
  }

  useEffect(() => {
    if (loaded && mapInstanceRef.current) {
      updateMarkers();
    }
  }, [alerts, loaded]);

  function openInMaps(alert) {
    if (alert.location?.lat && alert.location?.lng) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${alert.location.lat},${alert.location.lng}`,
        "_blank"
      );
    }
  }

  if (error) {
    return (
      <div className="map-fallback">
        <p className="error">{error}</p>
        <p className="info">
          Add VITE_GOOGLE_MAPS_API_KEY to .env to enable maps
        </p>
        <div className="location-list">
          {alerts
            .filter((a) => a.location?.lat && a.location?.lng)
            .map((alert) => (
              <div key={alert._id} className="location-item">
                <strong>{alert.type}</strong>
                <span>{alert.cameraLabel || "Unknown Camera"}</span>
                <span>
                  {alert.location.lat.toFixed(4)}, {alert.location.lng.toFixed(4)}
                </span>
                <button
                  type="button"
                  onClick={() => openInMaps(alert)}
                  className="small-btn"
                >
                  Open in Maps
                </button>
              </div>
            ))}
        </div>
      </div>
    );
  }

  if (!loaded) {
    return <div className="map-loading">Loading map...</div>;
  }

  return (
    <div className="map-container">
      <div ref={mapRef} className="map" />
      {!GOOGLE_MAPS_API_KEY && (
        <div className="map-placeholder">
          <p>Google Maps API key not configured</p>
          <p className="small">
            Add VITE_GOOGLE_MAPS_API_KEY to frontend/.env to enable maps
          </p>
        </div>
      )}
    </div>
  );
}
