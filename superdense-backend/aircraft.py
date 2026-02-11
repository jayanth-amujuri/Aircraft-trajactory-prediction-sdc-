from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import math
import time
import csv
import os

app = Flask(__name__)
CORS(app)

SIMULATED_CSV = "simulated_flights.csv"  # Path to your CSV

# -------------------------------
# Pakistan-Occupied Kashmir (PoK) and Aksai Chin as Restricted Areas
# -------------------------------
RESTRICTED_AREAS = [
    # PoK
    [
        (33.90, 73.50),
        (34.50, 73.80),
        (35.05, 74.50),
        (34.80, 75.20),
        (34.40, 75.30),
        (33.80, 74.90),
        (33.50, 74.30)
    ],
    # Aksai Chin
    [
        (35.50, 78.10),
        (36.10, 78.50),
        (36.50, 79.00),
        (36.20, 79.50),
        (35.80, 79.20),
        (35.60, 78.80)
    ]
]

# -------------------------------
# Check if point is in any restricted area using Ray Casting
# -------------------------------
def is_in_restricted_area(lat, lon):
    x = lon
    y = lat

    for area in RESTRICTED_AREAS:
        n = len(area)
        inside = False
        p1x, p1y = area[0][1], area[0][0]
        for i in range(n + 1):
            p2x, p2y = area[i % n][1], area[i % n][0]
            if y > min(p1y, p2y):
                if y <= max(p1y, p2y):
                    if x <= max(p1x, p2x):
                        if p1y != p2y:
                            xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if p1x == p2x or x <= xinters:
                            inside = not inside
            p1x, p1y = p2x, p2y
        if inside:
            return True
    return False

# Helper to convert boolean to Yes/No
def yes_no(value):
    return "Yes" if value else "No"

# -------------------------------
# Load simulated flights from CSV
# -------------------------------
def load_simulated_flights():
    if not os.path.exists(SIMULATED_CSV):
        print("❌ Simulated flights CSV not found!")
        return []

    flights_dict = {}
    with open(SIMULATED_CSV, newline='') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            icao = row["icao24"]
            if icao not in flights_dict:
                flights_dict[icao] = {
                    "icao24": icao,
                    "callsign": row["callsign"],
                    "route": row.get("route", ""),
                    "latitude": float(row["lat"]),
                    "longitude": float(row["lon"]),
                    "altitude": float(row["altitude"]),
                    "velocity": float(row["velocity"]),
                    "heading": float(row["heading"]),
                    "timestamps": []
                }
            flights_dict[icao]["timestamps"].append({
                "lat": float(row["lat"]),
                "lon": float(row["lon"]),
                "altitude": float(row["altitude"]),
                "velocity": float(row["velocity"]),
                "heading": float(row["heading"]),
                "timestamp": int(row["timestamp"]),
                "restricted": yes_no(is_in_restricted_area(float(row["lat"]), float(row["lon"])))
            })

    flights = []
    for flight in flights_dict.values():
        latest_pos = flight["timestamps"][-1]
        flights.append({
            "icao24": flight["icao24"],
            "callsign": flight["callsign"],
            "route": flight["route"],
            "latitude": latest_pos["lat"],
            "longitude": latest_pos["lon"],
            "altitude": latest_pos["altitude"],
            "velocity": latest_pos["velocity"],
            "heading": latest_pos["heading"],
            "timestamps": flight["timestamps"],
            "restricted": yes_no(is_in_restricted_area(latest_pos["lat"], latest_pos["lon"])),
            "source": "simulated"  # mark as simulated
        })
    print(f"✅ Loaded {len(flights)} simulated flights from CSV")
    return flights

# -------------------------------
# Fetch Live Flights (merge with simulated)
# -------------------------------
def fetch_live_flights():
    url = "https://opensky-network.org/api/states/all"
    flights = []
    live_available = False

    try:
        resp = requests.get(url, timeout=10).json()
        if "states" in resp and resp["states"]:
            live_available = True
            for s in resp["states"]:
                if not s:
                    continue
                flight = {
                    "icao24": s[0],
                    "callsign": s[1].strip() if s[1] else "N/A",
                    "country": s[2],
                    "latitude": s[6],
                    "longitude": s[5],
                    "altitude": s[7],
                    "on_ground": s[8],
                    "velocity": s[9],
                    "heading": s[10],
                }
                if flight["latitude"] is not None and flight["longitude"] is not None:
                    flight["restricted"] = yes_no(is_in_restricted_area(flight["latitude"], flight["longitude"]))
                    flight["source"] = "live"
                    flights.append(flight)
    except Exception as e:
        print("❌ Error fetching live states:", e)

    if not live_available:
        print("⚠️ Live flights are not available. Only simulated flights will be returned.")

    simulated = load_simulated_flights()
    for s in simulated:
        if not any(f["icao24"] == s["icao24"] for f in flights):
            flights.append(s)

    print(f"✅ Returning {len(flights)} flights (live + simulated)")
    return flights

# -------------------------------
# Fetch Historical Track
# -------------------------------
def fetch_flight_track(icao24):
    end = int(time.time())
    url = f"https://opensky-network.org/api/tracks/all?icao24={icao24}&time={end}"
    try:
        resp = requests.get(url, timeout=10).json()
        if "path" in resp:
            path = [{
                "lat": p[1], "lon": p[2], "altitude": p[3] or 0,
                "timestamp": p[0],
                "velocity": None,  # OpenSky track API does not return velocity
                "heading": None,
                "restricted": yes_no(is_in_restricted_area(p[1], p[2]))
            } for p in resp["path"] if p[1] is not None and p[2] is not None]
            if path:
                return path
    except Exception as e:
        print("❌ Error fetching track:", e)

    simulated_flights = load_simulated_flights()
    flight = next((f for f in simulated_flights if f["icao24"] == icao24), None)
    if flight:
        print(f"⚠️ Using simulated track for {icao24}")
        return flight["timestamps"]
    return []

# -------------------------------
# Predict Trajectory
# -------------------------------
def predict_trajectory(flight, steps=10, interval=60):
    lat = flight["latitude"]
    lon = flight["longitude"]
    vel = flight.get("velocity")
    heading = flight.get("heading")

    timestamps = flight.get("timestamps", [])
    if len(timestamps) >= 2:
        last = timestamps[-1]
        prev = timestamps[-2]
        delta_lat = math.radians(last["lat"] - prev["lat"])
        delta_lon = math.radians(last["lon"] - prev["lon"])
        avg_lat = math.radians((last["lat"] + prev["lat"]) / 2)
        R = 6371e3
        dx = delta_lon * math.cos(avg_lat) * R
        dy = delta_lat * R
        dt = last["timestamp"] - prev["timestamp"]
        if dt > 0:
            vel = math.sqrt(dx**2 + dy**2) / dt
            heading = math.degrees(math.atan2(dx, dy)) % 360
            lat = last["lat"]
            lon = last["lon"]

    if lat is None or lon is None or vel is None or heading is None:
        return []

    predictions = []
    R = 6371e3
    heading_rad = math.radians(heading)
    start_time = int(time.time())

    for step in range(steps):
        distance = vel * interval * (step + 1)
        dR = distance / R
        lat_rad = math.radians(lat)
        lon_rad = math.radians(lon)

        new_lat = math.asin(
            math.sin(lat_rad) * math.cos(dR)
            + math.cos(lat_rad) * math.sin(dR) * math.cos(heading_rad)
        )
        new_lon = lon_rad + math.atan2(
            math.sin(heading_rad) * math.sin(dR) * math.cos(lat_rad),
            math.cos(dR) - math.sin(lat_rad) * math.sin(new_lat),
        )

        new_lat_deg = math.degrees(new_lat)
        new_lon_deg = math.degrees(new_lon)
        predictions.append({
            "step": step + 1,
            "lat": new_lat_deg,
            "lon": new_lon_deg,
            "altitude": flight["altitude"],
            "velocity": vel,
            "heading": heading,
            "timestamp": start_time + (step + 1) * interval,
            "restricted": yes_no(is_in_restricted_area(new_lat_deg, new_lon_deg))
        })

    return predictions

# -------------------------------
# API: Get Live + Simulated Flights
# -------------------------------
@app.route("/api/flights", methods=["GET"])
def api_flights():
    flights = fetch_live_flights()
    return jsonify({"flights": flights})

# -------------------------------
# API: Predict Flight Path
# -------------------------------
@app.route("/api/predict", methods=["GET"])
def api_predict():
    icao24 = request.args.get("icao24")
    if not icao24:
        return jsonify({"error": "Missing ICAO24"}), 400

    flights = fetch_live_flights()
    flight = next((f for f in flights if f["icao24"] == icao24), None)
    if not flight:
        return jsonify({"error": "Flight not found"}), 404

    historical_path = fetch_flight_track(icao24)
    predicted_path = predict_trajectory(flight)
    last_predicted = predicted_path[-1] if predicted_path else None

    return jsonify({
        "flight": flight,
        "historical_path": historical_path,
        "predicted_path": predicted_path,
        "last_predicted": last_predicted
    })

if __name__ == "__main__":
    app.run(debug=True, port=5002)
