import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister, transpile
from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2 as Sampler
from qiskit.providers.exceptions import QiskitBackendNotFoundError
from dotenv import load_dotenv

# --- Flask & Socket.IO Setup ---
app = Flask(__name__)
CORS(app) # Keep CORS for the initial HTTP request from the frontend
app.config['SECRET_KEY'] = 'your-very-secret-key!'
socketio = SocketIO(app, cors_allowed_origins="*")

# --- IBM Quantum Config ---
load_dotenv()
TOKEN = os.getenv("IBM_TOKEN")
INSTANCE = os.getenv("IBM_INSTANCE")

if not TOKEN or not INSTANCE:
    raise ValueError("Missing IBM credentials. Please set IBM_TOKEN and IBM_INSTANCE in .env")

print("🔗 Connecting to IBM Quantum...")
service = QiskitRuntimeService(channel="ibm_quantum_platform", token=TOKEN, instance=INSTANCE)

# --- FIX: Try to connect to 'ibm_brisbane', with a robust fallback ---
try:
    backend = service.backend("ibm_torino")
    print("✅ Successfully connected to target backend: ibm_torino")
except QiskitBackendNotFoundError:
    print("\n⚠ WARNING: Backend 'ibm_torino' not found or you don't have access.")
    print("   Falling back to the least busy available simulator to prevent crashing.\n")
    backend = service.least_busy(simulator=True, operational=True)

print(f"✅ Using backend: {backend.name}\n")


# --- Helper: Build SDC circuit ---
def build_sdc_circuit(bits: str, index: int) -> QuantumCircuit:
    """Builds a full Superdense Coding circuit for a 2-bit chunk."""
    alice_q = QuantumRegister(1, f"alice_q{index}")
    bob_q = QuantumRegister(1, f"bob_q{index}")
    classical_res = ClassicalRegister(2, f"result_c{index}")
    qc = QuantumCircuit(alice_q, bob_q, classical_res)

    # Create Bell pair
    qc.h(alice_q[0])
    qc.cx(alice_q[0], bob_q[0])

    # Alice encodes her 2-bit chunk
    if bits[1] == "1": qc.x(alice_q[0])
    if bits[0] == "1": qc.z(alice_q[0])

    # Bob decodes and measures
    qc.cx(alice_q[0], bob_q[0])
    qc.h(alice_q[0])
    qc.measure(bob_q[0], classical_res[0])
    qc.measure(alice_q[0], classical_res[1])

    return qc

# --- Helper: Convert signed integer to two's complement binary ---
def int_to_twos_complement(n: int, bits: int) -> str:
    """Converts a signed integer to a two's complement binary string."""
    if n < 0:
        n = (1 << bits) + n
    return format(n, f"0{bits}b")

# --- Main Flask Route to Send Data ---
@app.route("/sdc/send", methods=["GET"])
def send_sdc():
    """Receives coordinate data, creates quantum jobs, and broadcasts their IDs."""
    try:
        print("Received /sdc/send request...")
        lat = float(request.args.get("latitude", "0.0"))
        lon = float(request.args.get("longitude", "0.0"))
        restricted_status = int(request.args.get("restricted_status", "0"))

        lat_int = int(round(lat * 1e3))
        lon_int = int(round(lon * 1e3))

        LAT_BITS, LON_BITS = 18, 19
        lat_bin = int_to_twos_complement(lat_int, LAT_BITS)
        lon_bin = int_to_twos_complement(lon_int, LON_BITS)
        status_bin = format(restricted_status, "01b")

        message = lat_bin + lon_bin + status_bin
        chunks = [message[i:i+2] for i in range(0, len(message), 2)]

        job_ids = []
        sampler = Sampler(backend)

        # Run each chunk as a separate job
        for i, bits in enumerate(chunks):
            qc = build_sdc_circuit(bits, i)
            transpiled_qc = transpile(qc, backend=backend, optimization_level=1)
            job = sampler.run([transpiled_qc], shots=1024)
            job_ids.append(job.job_id())
            print(f"✅ Submitted chunk {i+1}/{len(chunks)}: Job ID {job.job_id()}")

        # Broadcast job IDs and metadata to all connected clients
        socketio.emit("new_quantum_jobs", {"job_ids": job_ids, "lat_bits": LAT_BITS, "lon_bits": LON_BITS})
        print("🔊 Broadcasted Job IDs via Socket.IO.")

        return jsonify({
            "message": "All jobs submitted successfully.",
            "job_ids": job_ids
        }), 200

    except Exception as e:
        print(f"Error in /sdc/send: {e}")
        return jsonify({"error": str(e)}), 500

# --- Socket.IO Event Handlers ---
@socketio.on('connect')
def handle_connect():
    print("✅ Client connected to Socket.IO")

@socketio.on('disconnect')
def handle_disconnect():
    print("❌ Client disconnected")

# --- Run the Flask-SocketIO server ---
if __name__  == "__main__":
    print("Starting Flask-SocketIO server on http://0.0.0.0:5006")
    # socketio.run(app, host="0.0.0.0", port=5006, debug=True)
    socketio.run(
        app,
        host="0.0.0.0",
        port=5006,
        debug=False,        # ❗ REQUIRED
        use_reloader=False # ❗ REQUIRED
    )