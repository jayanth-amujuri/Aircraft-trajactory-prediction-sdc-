import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister, transpile
from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2 as Sampler
from qiskit.providers.exceptions import QiskitBackendNotFoundError
from dotenv import load_dotenv
from pymongo import MongoClient
from urllib.parse import quote_plus
import certifi

# --- Flask Setup ---
app = Flask(__name__)
# Allow requests from your React frontend
CORS(app, origins=["http://localhost:5173"])

# --- IBM Quantum Configuration ---
load_dotenv()
# It's recommended to use environment variables for sensitive data
TOKEN = os.getenv("IBM_TOKEN")
INSTANCE = os.getenv("IBM_INSTANCE")

if not TOKEN or not INSTANCE:
    print("Error: Missing IBM_TOKEN or IBM_INSTANCE from environment variables.")
    exit()

print("🔗 Connecting to IBM Quantum...")
try:
    service = QiskitRuntimeService(channel="ibm_quantum_platform", token=TOKEN, instance=INSTANCE)
    backend = service.backend("ibm_torino")
    print(f"✅ Target backend: {backend.name}")
except Exception as e:
    print(f"⚠ Could not connect to 'ibm_torino' ({e}). Using least busy simulator as fallback.")
    try:
        service = QiskitRuntimeService()
        backend = service.least_busy(simulator=True, operational=True)
        print(f"✅ Using fallback backend: {backend.name}\n")
    except Exception as fallback_e:
        print(f"❌ Failed to connect to IBM Quantum services: {fallback_e}")
        exit()


# --- MongoDB Atlas Configuration ---
# It's better to store these in environment variables as well
MONGO_USER = os.getenv("MONGO_USER")
MONGO_PASSWORD = os.getenv("MONGO_PASSWORD")
MONGO_CLUSTER_URL = os.getenv("MONGO_CLUSTER_URL")

if not all([MONGO_USER, MONGO_PASSWORD, MONGO_CLUSTER_URL]):
    print("Error: Missing MongoDB credentials from environment variables.")
    exit()

# URL-encode the password to handle special characters
encoded_password = quote_plus(MONGO_PASSWORD)
MONGO_URI = f"mongodb+srv://{MONGO_USER}:{encoded_password}@{MONGO_CLUSTER_URL}/?retryWrites=true&w=majority"

try:
    client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
    db = client.quantum_jobs
    collection = db.jobs
    # The ismaster command is cheap and does not require auth.
    client.admin.command('ismaster')
    print("✅ Connected to MongoDB Atlas.\n")
except Exception as e:
    print(f"❌ Could not connect to MongoDB Atlas: {e}")
    exit()


# --- Helper: Build Superdense Coding circuit ---
def build_sdc_circuit(bits: str, index: int) -> QuantumCircuit:
    """Creates a quantum circuit for superdense coding of 2 bits."""
    # Create unique names for registers to avoid conflicts in combined circuits if needed
    alice_q = QuantumRegister(1, f"alice_q{index}")
    bob_q = QuantumRegister(1, f"bob_q{index}")
    classical_res = ClassicalRegister(2, f"result_c{index}")
    qc = QuantumCircuit(alice_q, bob_q, classical_res)

    # 1. Create Bell pair (entanglement)
    qc.h(alice_q[0])
    qc.cx(alice_q[0], bob_q[0])
    qc.barrier()

    # 2. Alice encodes her 2 bits (bits[0] is Z, bits[1] is X)
    if bits[1] == "1":
        qc.x(alice_q[0])
    if bits[0] == "1":
        qc.z(alice_q[0])
    qc.barrier()

    # 3. Alice sends her qubit to Bob, who decodes and measures
    qc.cx(alice_q[0], bob_q[0])
    qc.h(alice_q[0])
    qc.barrier()
    qc.measure(bob_q[0], classical_res[0])
    qc.measure(alice_q[0], classical_res[1])

    return qc

# --- Helper: Convert signed integer to two's complement binary ---
def int_to_twos_complement(n: int, bits: int) -> str:
    """Converts a signed integer to its two's complement binary representation."""
    if n < 0:
        # For negative numbers, calculate (2^bits + n)
        n = (1 << bits) + n
    # Format to the specified number of bits, padding with leading zeros
    binary = format(n, f"0{bits}b")
    return binary

# --- Main Flask Route to Send Data ---
@app.route("/sdc/send", methods=["GET"])
def send_sdc():
    """
    Receives coordinate data, converts it to a binary string,
    and submits it chunk by chunk to an IBM Quantum backend.
    """
    try:
        # 1. Get and validate input parameters from the request
        lat = float(request.args.get("latitude", "0.0"))
        lon = float(request.args.get("longitude", "0.0"))
        restricted_status = int(request.args.get("restricted_status", "0"))
        if restricted_status not in (0, 1):
            return jsonify({"error": "restricted_status must be 0 or 1"}), 400

        # 2. Convert float coordinates to integers for binary representation
        # Increased precision by scaling with 1e5
        lat_int = int(round(lat * 1e5))
        lon_int = int(round(lon * 1e5))

        # 3. Convert integers to a fixed-width two's complement binary string
        # Using 32 bits provides a robust range for scaled coordinates.
        # This is the key fix to properly handle all positive and negative values.
        DATA_BITS = 32
        lat_bin = int_to_twos_complement(lat_int, DATA_BITS)
        lon_bin = int_to_twos_complement(lon_int, DATA_BITS)
        status_bin = format(restricted_status, "01b") # 1-bit for status

        # 4. Construct the full message and prepare for transmission
        message = lat_bin + lon_bin + status_bin
        if len(message) % 2 != 0:
            message += "0"  # Pad with a '0' if the message length is odd
        chunks = [message[i:i+2] for i in range(0, len(message), 2)]

        # 5. Submit each 2-bit chunk as a separate quantum job
        job_ids = []
        # Initialize the sampler once outside the loop for efficiency
        sampler = Sampler(backend)

        for i, bits in enumerate(chunks):
            qc = build_sdc_circuit(bits, i)
            # Transpile the circuit for the target backend
            transpiled_qc = transpile(qc, backend=backend, optimization_level=1)

            # Run the job
            job = sampler.run([transpiled_qc], shots=1024)
            job_id = job.job_id()
            job_ids.append(job_id)

            # Store job metadata in MongoDB for later retrieval
            collection.insert_one({
                "job_id": job_id,
                "status": "pending",
                "chunk_index": i,
                "total_chunks": len(chunks)
            })
            print(f"✅ Submitted chunk {i+1}/{len(chunks)}: Job ID {job_id}")

        return jsonify({
            "message": "All jobs submitted successfully.",
            "job_ids": job_ids,
            "binary_message": message,
            "chunks": chunks
        }), 200

    except Exception as e:
        print(f"❌ Error in /sdc/send: {e}")
        return jsonify({"error": str(e)}), 500

# --- Run Flask server ---
if __name__ == "__main__":
    # Use port 5005 as specified in the original file
    print("🚀 Starting Flask server on http://0.0.0.0:5005")
    # app.run(host="0.0.0.0", port=5005, debug=True)
    app.run(
        host="0.0.0.0",
        port=5005,
        debug=False,      # ❗ VERY IMPORTANT
        use_reloader=False  # ❗ VERY IMPORTANT
    )