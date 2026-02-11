import io
import random
import base64
import numpy as np
import logging
import requests
from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
from datetime import datetime
import pytz  # Added for timezone conversion
from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister, transpile
from qiskit_aer import AerSimulator
from qiskit.quantum_info import Statevector, DensityMatrix, partial_trace
from qiskit.visualization.bloch import Bloch

# Use a non-interactive backend for Matplotlib, suitable for servers
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def fig_to_base64(fig):
    """Converts a Matplotlib figure to a base64 encoded string."""
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", facecolor='none')
    buf.seek(0)
    img_str = base64.b64encode(buf.read()).decode("utf-8")
    plt.close(fig)
    return img_str


def plot_qubit_bloch(state, qubit_index=0, title="Qubit Bloch Sphere", description=""):
    # Reduce the state to the qubit of interest (if multi-qubit state)
    reduced_dm = partial_trace(state, [i for i in range(state.num_qubits) if i != qubit_index])
    
    # Pauli matrices
    X = np.array([[0, 1], [1, 0]])
    Y = np.array([[0, -1j], [1j, 0]])
    Z = np.array([[1, 0], [0, -1]])
    
    bloch_vector = [
        np.real(np.trace(reduced_dm.data @ X)),  # X-component
        np.real(np.trace(reduced_dm.data @ Y)),  # Y-component
        np.real(np.trace(reduced_dm.data @ Z)),  # Z-component
    ]
    
    fig = plt.figure(figsize=(4, 4))
    ax = fig.add_subplot(111, projection='3d')
    b = Bloch(axes=ax)
    b.add_vectors(bloch_vector)
    b.title = title
    fig.text(0.5, 0.01, description, wrap=True, horizontalalignment='center', fontsize=8)
    b.render()
    return fig_to_base64(fig)


def complex_to_json(obj):
    """Recursively converts an object to be JSON serializable, handling complex numbers."""
    if isinstance(obj, (np.complex128, complex)):
        return {"real": obj.real, "imaginary": obj.imag}
    if isinstance(obj, np.ndarray):
        return complex_to_json(obj.tolist())
    if isinstance(obj, list):
        return [complex_to_json(item) for item in obj]
    if isinstance(obj, dict):
        return {key: complex_to_json(value) for key, value in obj.items()}
    if isinstance(obj, (np.float64, np.float32)):
        return float(obj)
    if isinstance(obj, (np.int64, np.int32)):
        return int(obj)
    return obj


def convert_timestamp_to_realtime(timestamp, timezone='Asia/Kolkata'):
    """Converts a Unix timestamp to a human-readable local time string."""
    try:
        dt_utc = datetime.fromtimestamp(timestamp, pytz.utc)
        local_tz = pytz.timezone(timezone)
        dt_local = dt_utc.astimezone(local_tz)
        return dt_local.strftime('%Y-%m-%d %H:%M:%S %Z')
    except Exception:
        return "Invalid Timestamp"


def get_satellite_message():
    """Fetches real satellite data and returns detailed information."""
    API_KEY = "483GR2-T9547D-3KK4SX-5K32"  # Replace with your N2YO API key
    SAT_ID = 25544  # ISS (International Space Station)
    LAT, LON = 16.5, 81.5  # Observer's ground station coordinates (Bhimavaram, India)
    try:
        url = f"https://api.n2yo.com/rest/v1/satellite/positions/{SAT_ID}/{LAT}/{LON}/0/1/&apiKey={API_KEY}"
        resp = requests.get(url, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        pos = data["positions"][0]

        lat_bit = "1" if pos["satlatitude"] >= 0 else "0"
        lon_bit = "1" if pos["satlongitude"] >= 0 else "0"
        
        timestamp = pos.get("timestamp", 0)
        real_time = convert_timestamp_to_realtime(timestamp)
        eclipsed = pos.get("eclipsed", False)

        return {
            "binary_message": f"{lat_bit}{lon_bit}",
            "latitude": pos.get("satlatitude", 0.0),
            "longitude": pos.get("satlongitude", 0.0),
            "real_time": real_time,
            "eclipsed": eclipsed,
        }
    except Exception as e:
        logger.warning(f"Satellite API fetch failed: {str(e)}. Using default data.")
        return {
            "binary_message": "01",
            "latitude": 0.0,
            "longitude": 0.0,
            "real_time": "N/A",
            "eclipsed": False,
        }


# ----------------------
# E91 QKD Implementation


def e91_qkd(num_pairs=1000, backend=None, eve=False):
    """
    Correct CHSH-based E91 implementation.
    """

    alice_angles = [0, 45]
    bob_angles = [22.5, -22.5]

    key_bits = []
    key_rounds = 0
    mismatches = 0

    alice_measurements = []
    bob_measurements = []

    correlation_data = {
        (0, 22.5): [],
        (0, -22.5): [],
        (45, 22.5): [],
        (45, -22.5): []
    }

    for pair_idx in range(num_pairs):

        alice_angle = random.choice(alice_angles)
        bob_angle = random.choice(bob_angles)

        theta = np.radians(alice_angle - bob_angle)

        # Correct quantum correlation
        E_theta = -np.cos(2 * theta)

        if eve:
            # Eve destroys entanglement → classical limit
            E_theta *= 0.5

        p_same = (1 + E_theta) / 2

        if random.random() < p_same:
            alice_bit = random.choice([0, 1])
            bob_bit = alice_bit
        else:
            alice_bit = random.choice([0, 1])
            bob_bit = 1 - alice_bit

        alice_measurements.append({
            "angle": alice_angle,
            "bit": str(alice_bit),
            "pair_index": pair_idx
        })

        bob_measurements.append({
            "angle": bob_angle,
            "bit": str(bob_bit),
            "pair_index": pair_idx
        })

        a_val = 1 if alice_bit == 1 else -1
        b_val = 1 if bob_bit == 1 else -1

        correlation_data[(alice_angle, bob_angle)].append(a_val * b_val)

        # Key from (0°, 22.5°)
        if alice_angle == 0 and bob_angle == 22.5:
            key_rounds += 1
            flipped_alice = alice_bit ^ 1
            key_bits.append(str(flipped_alice))

            if flipped_alice != bob_bit:
                mismatches += 1

    def compute_E(values):
        if len(values) == 0:
            return 0
        return sum(values) / len(values)

    E_ab = compute_E(correlation_data[(0, 22.5)])
    E_abp = compute_E(correlation_data[(0, -22.5)])
    E_apb = compute_E(correlation_data[(45, 22.5)])
    E_apbp = compute_E(correlation_data[(45, -22.5)])

    S = E_ab + E_abp + E_apb - E_apbp

    if key_rounds > 0:
        qber = mismatches / key_rounds
    else:
        qber = 1.0

    secure = abs(S) > 2

    return {
        "qkd_key": "".join(key_bits),
        "qber": qber,   
        "qber_percentage": qber * 100,
        "secure": secure,
        "sifted_bits_count": len(key_bits),
        "total_pairs": num_pairs,
        "matched_basis_count": key_rounds,
        "alice_measurements": alice_measurements,
        "bob_measurements": bob_measurements,
        "S_value": S,
        "bell_violated": abs(S) > 2,
        "eve_present": eve
    }

def superdense_coding(message: str, key_bits, eve=False, backend=None):
    if backend is None:
        backend = AerSimulator()

    if not isinstance(message, str) or len(message) != 2:
        raise ValueError("Message must be a 2-bit string like '00','01','10','11'")

    if key_bits and len(key_bits) >= 2:
        kb0, kb1 = key_bits[0], key_bits[1]
        def xor_bit(mb, kb): return '1' if mb != str(kb) else '0'
        encrypted = (xor_bit(message[0], kb0), xor_bit(message[1], kb1))
    else:
        encrypted = (message[0], message[1])

    qr = QuantumRegister(2, "q")
    cr = ClassicalRegister(2, "c")
    qc = QuantumCircuit(qr, cr)
    qc.h(qr[0])
    qc.cx(qr[0], qr[1])
    qc.barrier()

    if encrypted == ("0", "1"):
        qc.x(qr[0])
    elif encrypted == ("1", "0"):
        qc.z(qr[0])
    elif encrypted == ("1", "1"):
        qc.x(qr[0])
        qc.z(qr[0])
    qc.barrier()

    if eve:
        eve_basis = random.choice(["Z", "X"])
        if eve_basis == "X":
            qc.h(qr[0])
        qc.measure(qr[0], cr[0])
        qc.reset(qr[0])
        if random.random() < 0.5:
            qc.x(qr[0])
        if eve_basis == "X":
            qc.h(qr[0])
        qc.barrier()

    qc.cx(qr[0], qr[1])
    qc.h(qr[0])
    qc.barrier()
    qc.measure([qr[0], qr[1]], [cr[0], cr[1]])

    try:
        viz_qc = qc.remove_final_measurements(inplace=False)
        state_for_viz = Statevector.from_instruction(viz_qc)
    except Exception:
        viz_qc = QuantumCircuit(2)
        viz_qc.h(0); viz_qc.cx(0,1)
        state_for_viz = Statevector.from_instruction(viz_qc)

    density = DensityMatrix(state_for_viz)
    tqc = transpile(qc, backend)
    result = backend.run(tqc, shots=1024).result()
    counts = result.get_counts()

    def complex_to_json(obj):
        if isinstance(obj, complex):
            return {"real": float(obj.real), "imag": float(obj.imag)}
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, list):
            return [complex_to_json(item) for item in obj]
        elif isinstance(obj, dict):
            return {key: complex_to_json(value) for key, value in obj.items()}
        else:
            return obj

    circuit_png = None
    try:
        circuit_png = fig_to_base64(qc.draw(output="mpl"))
    except Exception:
        circuit_png = None

    return {
        "encrypted_message": encrypted,
        "entanglement_status": ("Destroyed by Eve" if eve else "Entanglement OK"),
        "communication_status": ("Garbled" if eve else "OK"),
        "circuit_png": circuit_png,
        "statevector": complex_to_json(state_for_viz.data.tolist()),
        "density_matrix": complex_to_json(density.data.tolist()),
        "bloch_spheres": [
            plot_qubit_bloch(state_for_viz, 0, "SDC Qubit 0", f"Encrypted bits {encrypted}"),
            plot_qubit_bloch(state_for_viz, 1, "SDC Qubit 1", "Partner qubit")
        ],
        "histogram": counts
    }

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}}, supports_credentials=True)

backend = AerSimulator()


# @app.route("/qkd", methods=["POST"])
@app.route("/api/qkd_simulation", methods=["POST", "OPTIONS"])
def qkd_route():
    """Generate a QKD key using E91 protocol."""
    
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200
    
    try:
        data = request.json or {}
        num_pairs = int(data.get("num_pairs", data.get("num_qubits", 1000)))
        eve = bool(data.get("eve", False))

        # 🔥 Call E91 only once (NO artificial key length forcing)
        qkd_result = e91_qkd(num_pairs=num_pairs, backend=backend, eve=eve)

        return jsonify({
            "qkd_key": qkd_result["qkd_key"],
            "qber": qkd_result["qber"],
            "qber_percentage": qkd_result["qber_percentage"],
            "secure": qkd_result["secure"],
            "sifted_bits_count": qkd_result["sifted_bits_count"],
            "total_pairs": qkd_result["total_pairs"],
            "matched_basis_count": qkd_result["matched_basis_count"],
            "alice_measurements": qkd_result["alice_measurements"],
            "bob_measurements": qkd_result["bob_measurements"],
            "S_value": qkd_result["S_value"],
            "bell_violated": qkd_result["bell_violated"],
            "eve_present": qkd_result["eve_present"]
        })

    except Exception as e:
        logger.exception("QKD route failed")
        return jsonify({"error": f"QKD route failed: {str(e)}"}), 500


@app.route("/sdc", methods=["POST", "OPTIONS"])
def sdc_route():
    # Handle CORS preflight request
    if request.method == "OPTIONS":
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "http://localhost:5173")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response
        
    try:
        data = request.json or {}
        message = data.get("message", "00")
        key = data.get("qkd_key")
        qkd_secure = data.get("qkd_secure", True)
        eve = bool(data.get("eve", False))

        if not qkd_secure:
            return jsonify({"error": "QKD key compromised! Channel insecure. Restart key generation."}), 400
        if message not in ["00","01","10","11"]:
            return jsonify({"error": "Invalid message (must be 2-bit string)"}), 400
        if not key:
            return jsonify({"error": "QKD key is required (at least 2 bits)"}), 400

        result = superdense_coding(message, key, eve=eve, backend=backend)
        return jsonify(result)
    except Exception as e:
        logger.exception("SDC failed")
        return jsonify({"error": f"Superdense coding failed: {str(e)}"}), 500

@app.route("/full-simulation", methods=["POST"])
def full_simulation_route():
    try:
        data = request.json
        message = data.get("message", "00")
        num_qubits = int(data.get("num_qubits", 50))
        qkd_eve = bool(data.get("qkd_eve", False))
        sdc_eve = bool(data.get("sdc_eve", False))

        required_length = len(message)
        qkd_key = ""
        qkd_result = None

        while len(qkd_key) < required_length:
            qkd_result = e91_qkd(num_pairs=num_qubits, backend=backend, eve=qkd_eve)
            qkd_key += qkd_result.get("qkd_key", "")

        qkd_key = qkd_key[:required_length]
        qkd_result["qkd_key"] = qkd_key

        if not qkd_key or len(qkd_key) < 2:
            return jsonify({"error": "QKD failed to generate a secure key."}), 400

        sdc_result = superdense_coding(message, qkd_key, eve=sdc_eve, backend=backend)

        return jsonify({
            "qkd": qkd_result,
            "sdc": sdc_result
        })
    except Exception as e:
        logger.exception("Full simulation failed")
        return jsonify({"error": f"Full simulation failed: {str(e)}"}), 500


@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy", "message": "Satellite-Ground Communication Simulator Backend"})


if __name__ == "__main__":
    app.run(debug=True, port=5001)