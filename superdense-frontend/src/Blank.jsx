import React, { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
  Polygon
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import axios from "axios";
import "./AircraftNavigation.css";
import { useNavigate } from "react-router-dom";

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

// Custom blue icon for predicted point
const blueIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
  shadowUrl: markerShadow,
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
      x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0000001) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isRestricted(point) {
  return restrictedAreas.some((area) => pointInPolygon(point, area));
}

export default function AircraftNavigation() {
  const [flights, setFlights] = useState([]);
  const [selectedIcao24, setSelectedIcao24] = useState("");
  const [flightData, setFlightData] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get("http://127.0.0.1:5002/api/flights")
      .then((res) => setFlights(res.data.flights || []))
      .catch((err) => console.error("Error fetching flights:", err));
  }, []);

  const fetchTrajectory = async (icao24) => {
    try {
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

      setFlightData({
        ...data,
        historical_path: historical,
        predicted_path: predicted,
        last_predicted: predicted[predicted.length - 1]
      });
    } catch (err) {
      alert(err.response?.data?.error || "Error fetching trajectory");
    }
  };

  const handlePerformSDC = () => {
    if (!flightData || !flightData.last_predicted) return;

    // Round to 5 decimals before passing
    const roundedLat = Number(flightData.last_predicted.lat.toFixed(5));
    const roundedLon = Number(flightData.last_predicted.lon.toFixed(5));

    navigate("/ibm-cloud", {
      state: {
        latitude: roundedLat,
        longitude: roundedLon,
        restrictedStatus: flightData.last_predicted.restricted
      }
    });
  };

  return (
    <div className="aircraft-navigation">
      <div className="sidebar">
        <h2>Flight Navigation</h2>
        <div className="selector">
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
        </div>

        {flightData && flightData.last_predicted && (
          <div className="table-container">
            <h3>Predicted Point</h3>
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

            <button className="redirect-btn" onClick={handlePerformSDC}>
              Perform Superdense Coding
            </button>
          </div>
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
                  {flightData.flight.callsign} ({flightData.flight.icao24})
                  <br />
                  Source: {flightData.flight.source}
                  <br />
                  Restricted:{" "}
                  {flightData.flight.restricted ? "Yes" : "No"}
                </Popup>
              </Marker>

              <Marker
                position={[
                  flightData.last_predicted.lat,
                  flightData.last_predicted.lon
                ]}
                icon={blueIcon}
              >
                <Popup>
                  {flightData.flight.callsign} ({flightData.flight.icao24}) – Predicted Destination
                  <br />
                  Restricted: {flightData.last_predicted.restricted}
                </Popup>
              </Marker>
            </>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
