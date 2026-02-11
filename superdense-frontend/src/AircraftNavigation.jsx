import React, { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  Polygon,
  useMap
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";
import "./AircraftNavigation.css";
import { useNavigate } from "react-router-dom";
import aircraftImg from "./assets/aircraft.png";
import groundImg from "./assets/ground.png";

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
});

// Custom blue icon for predicted point
const blueIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to recenter map
function RecenterMap({ lat, lon }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lon) map.setView([lat, lon], 6);
  }, [lat, lon, map]);
  return null;
}

// Restricted areas polygons
const restrictedAreas = [
  [
    [33.9, 73.5],
    [34.5, 73.8],
    [35.05, 74.5],
    [34.8, 75.2],
    [34.4, 75.3],
    [33.8, 74.9],
    [33.5, 74.3]
  ],
  [
    [35.5, 78.1],
    [36.1, 78.5],
    [36.5, 79.0],
    [36.2, 79.5],
    [35.8, 79.2],
    [35.6, 78.8]
  ]
];

// Utility to check if a point is inside a polygon
function pointInPolygon(point, vs) {
  const x = point[1],
    y = point[0];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][1],
      yi = vs[i][0];
    const xj = vs[j][1],
      yj = vs[j][0];
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 0.000001) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isRestricted(point) {
  return restrictedAreas.some((area) => pointInPolygon(point, area));
}

// Dynamically load GSAP
const useGsapLoader = (onReady) => {
  React.useEffect(() => {
    if (window.gsap) {
      onReady();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js";
    script.async = true;
    script.onload = () => onReady();
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, [onReady]);
};

export default function AircraftNavigation() {
  const [flights, setFlights] = useState([]);
  const [selectedIcao24, setSelectedIcao24] = useState("");
  const [flightData, setFlightData] = useState(null);
  const [showCurrentTable, setShowCurrentTable] = useState(false);
  const [showPredictedTable, setShowPredictedTable] = useState(false);
  const [loadingFlights, setLoadingFlights] = useState(true);
  const [flightError, setFlightError] = useState("");
  const [gsapReady, setGsapReady] = useState(false);

  const navigate = useNavigate();

  const aircraftRef = useRef(null);
  const satelliteRef = useRef(null);
  const groundRef = useRef(null);
  const beam1Ref = useRef(null);
  const beam2Ref = useRef(null);

  // --- NEW: Generate sparkles ---
  const numSparkles = 50;
  const sparkles = Array.from({ length: numSparkles }).map((_, i) => ({
    id: i,
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    duration: `${2 + Math.random() * 3}s`,
    delay: `${Math.random() * 5}s`
  }));
  // --- END NEW ---

  useGsapLoader(() => setGsapReady(true));

  useEffect(() => {
    setLoadingFlights(true);
    axios
      .get("http://127.0.0.1:5002/api/flights")
      .then((res) => {
        setFlights(res.data.flights || []);
        setLoadingFlights(false);
        setFlightError("");
      })
      .catch((err) => {
        setFlights([]);
        setLoadingFlights(false);
        setFlightError("Error fetching flights. Please check backend or network.");
      });
  }, []);

  const fetchTrajectory = async (icao24) => {
    if (!icao24) return;
    try {
      setShowCurrentTable(false);
      setShowPredictedTable(false);
      const res = await axios.get("http://127.0.0.1:5002/api/predict", {
        params: { icao24 }
      });
      const data = res.data;

      const historical = data.historical_path.map((p) => ({
        ...p,
        restricted: isRestricted([p.lat, p.lon]) ? "Yes" : "No"
      }));

      const predicted = data.predicted_path.map((p) => ({
        ...p,
        restricted: isRestricted([p.lat, p.lon]) ? "Yes" : "No"
      }));

      const currentFlight = { ...data.flight };

      let lastPredicted = predicted[predicted.length - 1];
      if (
        lastPredicted &&
        lastPredicted.lat.toFixed(5) === currentFlight.latitude.toFixed(5) &&
        lastPredicted.lon.toFixed(5) === currentFlight.longitude.toFixed(5)
      ) {
        lastPredicted = null;
      }

      setFlightData({
        ...data,
        flight: currentFlight,
        historical_path: historical,
        predicted_path: predicted,
        last_predicted: lastPredicted
      });

      setTimeout(() => animateLaserBeams(() => {
        setShowCurrentTable(true);
      }), 300);
    } catch (err) {
      alert(err.response?.data?.error || "Error fetching trajectory");
    }
  };

  // laser animation functions remain same
  const animateLaserBeams = (onCompleteCallback) => {
    if (!gsapReady || !window.gsap) {
      if (onCompleteCallback) onCompleteCallback();
      return;
    }
    const gsap = window.gsap;
    if (!aircraftRef.current || !satelliteRef.current || !groundRef.current || !beam1Ref.current || !beam2Ref.current) {
      if (onCompleteCallback) onCompleteCallback();
      return;
    }

    const panel = aircraftRef.current.closest('.right-panel');
    const getCenter = (el) => {
      const rect = el.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      return {
        x: rect.left - panelRect.left + rect.width / 2,
        y: rect.top - panelRect.top + rect.height / 2
      };
    };
    const aircraft = getCenter(aircraftRef.current);
    const satellite = getCenter(satelliteRef.current);
    const ground = getCenter(groundRef.current);

    const defs = panel.querySelector("defs");
    let grad1 = document.getElementById("beam-gradient-1");
    if (!grad1) {
      grad1 = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
      grad1.setAttribute("id", "beam-gradient-1");
      grad1.setAttribute("gradientUnits", "userSpaceOnUse");
      defs.appendChild(grad1);
       ["#16a4ff", "#16a4ff", "#16a4ff", "#16a4ff"].forEach((color, i) => {
        const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop.setAttribute("offset", `${(i / 3) * 100}%`);
        stop.setAttribute("stop-color", color);
        grad1.appendChild(stop);
      });
    }
    grad1.setAttribute("x1", aircraft.x);
    grad1.setAttribute("y1", aircraft.y);
    grad1.setAttribute("x2", satellite.x);
    grad1.setAttribute("y2", satellite.y);
    beam1Ref.current.setAttribute("stroke", "url(#beam-gradient-1)");

    gsap.set(beam1Ref.current, {
      attr: { x1: aircraft.x, y1: aircraft.y, x2: aircraft.x, y2: aircraft.y },
      opacity: 1,
      filter: 'url(#beam-glow)',
      strokeDasharray: 1000,
      strokeDashoffset: 1000
    });
    gsap.to(beam1Ref.current, {
      attr: { x2: satellite.x, y2: satellite.y },
      duration: 2,
      ease: 'power2.inOut',
      delay: 1.2,
      onComplete: () => {
        gsap.to(beam1Ref.current, {
          strokeDashoffset: 0,
          duration: 1,
          ease: 'power2.out',
          onComplete: () => {
            gsap.to(beam1Ref.current, { opacity: 0, duration: 0.5 });
            let grad2 = document.getElementById("beam-gradient-2");
            if (!grad2) {
              grad2 = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
              grad2.setAttribute("id", "beam-gradient-2");
              grad2.setAttribute("gradientUnits", "userSpaceOnUse");
              defs.appendChild(grad2);
              ["#16a4ff", "#16a4ff", "#16a4ff", "#16a4ff"].forEach((color, i) => {
                const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
                stop.setAttribute("offset", `${(i / 3) * 100}%`);
                stop.setAttribute("stop-color", color);
                grad2.appendChild(stop);
              });
            }
            grad2.setAttribute("x1", satellite.x);
            grad2.setAttribute("y1", satellite.y);
            grad2.setAttribute("x2", ground.x);
            grad2.setAttribute("y2", ground.y);
            beam2Ref.current.setAttribute("stroke", "url(#beam-gradient-2)");
            gsap.set(beam2Ref.current, {
              attr: { x1: satellite.x, y1: satellite.y, x2: satellite.x, y2: satellite.y },
              opacity: 1,
              filter: 'url(#beam-glow)',
              strokeDasharray: 1000,
              strokeDashoffset: 1000
            });
            gsap.to(beam2Ref.current, {
              attr: { x2: ground.x, y2: ground.y },
              duration: 2,
              ease: 'power2.inOut',
              delay: 0.5,
              onComplete: () => {
                gsap.to(beam2Ref.current, {
                  strokeDashoffset: 0,
                  duration: 1,
                  ease: 'power2.out',
                  onComplete: () => {
                    gsap.to(beam2Ref.current, { opacity: 0, duration: 0.5 });
                    setTimeout(() => {
                      if (onCompleteCallback) onCompleteCallback();
                    }, 300);
                  }
                });
              }
            });
          }
        });
      }
    });
  };

  const handlePerformSDC = () => {
    if (!flightData || !flightData.last_predicted) return;
    setShowCurrentTable(false);
    setShowPredictedTable(false);
    animateReverseLaserBeams(() => {
      setShowPredictedTable(true);
    });
  };

  const animateReverseLaserBeams = (onCompleteCallback) => {
    if (!gsapReady || !window.gsap) {
      if (onCompleteCallback) onCompleteCallback();
      return;
    }
    const gsap = window.gsap;
    if (!aircraftRef.current || !satelliteRef.current || !groundRef.current || !beam1Ref.current || !beam2Ref.current) {
      if (onCompleteCallback) onCompleteCallback();
      return;
    }

    const panel = aircraftRef.current.closest('.right-panel');
    const getCenter = (el) => {
      const rect = el.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      return {
        x: rect.left - panelRect.left + rect.width / 2,
        y: rect.top - panelRect.top + rect.height / 2
      };
    };
    const aircraft = getCenter(aircraftRef.current);
    const satellite = getCenter(satelliteRef.current);
    const ground = getCenter(groundRef.current);

    gsap.set(beam1Ref.current, {
      attr: { x1: ground.x, y1: ground.y, x2: ground.x, y2: ground.y },
      opacity: 1,
      strokeDasharray: 1000,
      strokeDashoffset: 1000
    });
    gsap.to(beam1Ref.current, {
      attr: { x2: satellite.x, y2: satellite.y },
      duration: 1.5,
      ease: 'power2.inOut',
      onComplete: () => {
        gsap.to(beam1Ref.current, {
          strokeDashoffset: 0,
          duration: 1,
          ease: 'power2.out',
          onComplete: () => {
            gsap.to(beam1Ref.current, { opacity: 0, duration: 0.5 });
            gsap.set(beam2Ref.current, {
              attr: { x1: satellite.x, y1: satellite.y, x2: satellite.x, y2: satellite.y },
              opacity: 1,
              strokeDasharray: 1000,
              strokeDashoffset: 1000
            });
            gsap.to(beam2Ref.current, {
              attr: { x2: aircraft.x, y2: aircraft.y },
              duration: 1.5,
              ease: 'power2.inOut',
              onComplete: () => {
                gsap.to(beam2Ref.current, {
                  strokeDashoffset: 0,
                  duration: 1,
                  ease: 'power2.out',
                  onComplete: () => {
                    gsap.to(beam2Ref.current, { opacity: 0, duration: 0.5 });
                    setTimeout(() => {
                      if (onCompleteCallback) onCompleteCallback();
                    }, 300);
                  }
                });
              }
            });
          }
        });
      }
    });
  };

  return (
    <div className="aircraft-navigation fade-in">
      <div className="sidebar">
        <h2>Flight Navigation</h2>
        <div className="selector">
          {loadingFlights ? (
            <div style={{ color: '#aaa', marginBottom: '10px' }}>Loading flights...</div>
          ) : flightError ? (
            <div style={{ color: 'red', marginBottom: '10px' }}>{flightError}</div>
          ) : flights.length === 0 ? (
            <div style={{ color: '#aaa', marginBottom: '10px' }}>No flights available.</div>
          ) : (
            <>
              <select
                value={selectedIcao24}
                onChange={(e) => setSelectedIcao24(e.target.value)}
              >
                <option value="">Select Flight</option>
                {flights.map((f) => (
                  <option key={f.icao24} value={f.icao24}>
                    {f.callsign} ({f.icao24}) [{f.source}]
                  </option>
                ))}
              </select>
              <button
                onClick={() => fetchTrajectory(selectedIcao24)}
                disabled={!selectedIcao24}
              >
                Show Flight Path
              </button>
            </>
          )}
        </div>
        {/* MODIFIED: CURRENT FLIGHT DATA TABLE */}
        {showCurrentTable && flightData && flightData.flight && (
          <div className="table-container">
            <h3>Current Flight Data</h3>
            <table>
              <tbody>
                <tr>
                  <th>Latitude</th>
                  <td>{flightData.flight.latitude?.toFixed(5) || 'N/A'}</td>
                </tr>
                <tr>
                  <th>Longitude</th>
                  <td>{flightData.flight.longitude?.toFixed(5) || 'N/A'}</td>
                </tr>
                <tr>
                  <th>Altitude</th>
                  <td>{flightData.flight.altitude ? `${flightData.flight.altitude} ft` : 'N/A'}</td>
                </tr>
                <tr>
                  <th>Velocity</th>
                  <td>{flightData.flight.velocity ? `${flightData.flight.velocity} kts` : 'N/A'}</td>
                </tr>
                <tr>
                  <th>Heading</th>
                  <td>{flightData.flight.heading ? `${flightData.flight.heading}°` : 'N/A'}</td>
                </tr>
                <tr>
                  <th>Timestamp</th>
                  <td>
                    {flightData.flight.timestamp
                      ? new Date(flightData.flight.timestamp * 1000).toLocaleString()
                      : 'N/A'}
                  </td>
                </tr>
              </tbody>
            </table>
            <button className="redirect-btn" onClick={handlePerformSDC}>
              Perform Superdense Coding
            </button>
          </div>
        )}
        {showPredictedTable && flightData && flightData.last_predicted ? (
          <div className="table-container">
            <h3>Predicted Coordinates</h3>
            <table>
              <thead>
                <tr>
                  <th>Step</th>
                  <th>Latitude</th>
                  <th>Longitude</th>
                  <th>Restricted</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{flightData.last_predicted.step}</td>
                  <td>{flightData.last_predicted.lat.toFixed(5)}</td>
                  <td>{flightData.last_predicted.lon.toFixed(5)}</td>
                  <td>{flightData.last_predicted.restricted}</td>
                </tr>
              </tbody>
            </table>
            <button
              className="redirect-btn"
              style={{ marginTop: '10px', background: 'linear-gradient(135deg, #764ba2, #22d3ee)' }}
              onClick={() =>
                navigate('/full-simulation', {
                  state: {
                    predicted: flightData.last_predicted
                  }
                })
              }
            >
              Full Simulation
            </button>
          </div>
        ) : (
          showPredictedTable && (
            <div className="table-container">
              <h3>Predicted Coordinates</h3>
              <div style={{ color: 'orange', margin: '10px 0' }}>No distinct prediction available.</div>
            </div>
          )
        )}
      </div>

      <div className="map-section">
        <MapContainer center={[20, 78]} zoom={5} className="map">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {restrictedAreas.map((area, idx) => (
            <Polygon key={idx} positions={area} color="red" fillOpacity={0.2} />
          ))}
          {flightData && (
            <>
              <RecenterMap
                lat={flightData.flight.latitude}
                lon={flightData.flight.longitude}
              />
              <Polyline
                positions={flightData.historical_path.map((p) => [p.lat, p.lon])}
                color="green"
                weight={3}
              />
              <Polyline
                positions={flightData.predicted_path.map((p) => [p.lat, p.lon])}
                color="red"
                weight={3}
                dashArray="5,10"
              />
              <Marker
                position={[flightData.flight.latitude, flightData.flight.longitude]}
              >
                <Popup>
                  {flightData.flight.callsign} ({flightData.flight.icao24})<br />
                  Source: {flightData.flight.source}
                </Popup>
              </Marker>
              {flightData.last_predicted && (
                <Marker
                  position={[flightData.last_predicted.lat, flightData.last_predicted.lon]}
                  icon={blueIcon}
                >
                  <Popup>
                    Predicted Destination<br />
                    Restricted: {flightData.last_predicted.restricted}
                  </Popup>
                </Marker>
              )}
            </>
          )}
        </MapContainer>
      </div>

      <div className="right-panel">
        {/* --- NEW: Starfield and Sparkles Background --- */}
        <div className="stars-bg"></div>
        <div className="sparkles-container">
          {sparkles.map(s => (
            <div
              key={s.id}
              className="sparkle"
              style={{
                top: s.top,
                left: s.left,
                animationDuration: s.duration,
                animationDelay: s.delay,
              }}
            />
          ))}
        </div>
        {/* --- END NEW --- */}
        
        <img ref={satelliteRef} src="https://res.cloudinary.com/dkpjimiip/image/upload/v1757147259/pngegg_esf5tj.png" alt="Satellite" className="emoji satellite" />
        <img ref={aircraftRef} src={aircraftImg} alt="Aircraft" className="emoji plane" />
        <img ref={groundRef} src={groundImg} alt="Ground Station" className="emoji ground" />
        
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
          <defs>
            <filter id="beam-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <line ref={beam1Ref} stroke="url(#beam-gradient-1)" strokeWidth="8" strokeLinecap="round" filter="url(#beam-glow)" opacity="0" />
          <line ref={beam2Ref} stroke="url(#beam-gradient-2)" strokeWidth="8" strokeLinecap="round" filter="url(#beam-glow)" opacity="0" />
        </svg>
      </div>
    </div>
  );
}