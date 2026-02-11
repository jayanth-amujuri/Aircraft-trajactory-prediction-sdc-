import io
import time
import base64
import matplotlib

# CRITICAL: Use a non-GUI backend for Matplotlib in a server environment
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from flask import Flask, request, jsonify
from flask_cors import CORS
from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator

# --- Initialize Flask App and CORS ---
# CORS is necessary to allow your React frontend (on a different port) to call this backend.
app = Flask(__name__)
CORS(app)

# --- Initialize Qiskit Simulator (do this once) ---
simulator = AerSimulator()

def superdense_encode_decode(bits: str) -> str:
    """Encode 2 classical bits into 1 qubit using SDC, then decode."""
    qc = QuantumCircuit(2, 2)
    
    # Create entanglement
    qc.h(0)
    qc.cx(0, 1)
    
    # Alice encodes her message
    if bits == "01":
        qc.x(0)
    elif bits == "10":
        qc.z(0)
    elif bits == "11":
        qc.x(0)
        qc.z(0)
    
    # Bob decodes the message
    qc.cx(0, 1)
    qc.h(0)
    
    # Measure
    qc.measure([0, 1], [0, 1])
    
    # Simulate
    job = simulator.run(qc, shots=100)
    result = job.result()
    counts = result.get_counts()
    decoded_bits = max(counts, key=counts.get)
    
    # Qiskit's bit order is reversed, so we flip it back
    return decoded_bits[::-1]


@app.route("/compare", methods=["POST"])
def compare_channels():
    try:
        # --- 1. Get the message from the frontend request ---
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({"error": "Missing 'message' in request body"}), 400
        
        message = data['message']
        
        # Ensure message has an even number of bits for SDC
        if len(message) % 2 != 0:
            message += "0" # Pad with a '0' if odd length

        chunks = [message[i:i+2] for i in range(0, len(message), 2)]

        # --- 2. Run the simulations (your script's logic) ---
        
        # Classical Channel Simulation
        start_classical = time.time()
        for _ in message:
            time.sleep(0.01) # Using a smaller sleep time for a faster API response
        classical_time = time.time() - start_classical

        # Quantum Channel Simulation
        start_quantum = time.time()
        decoded_message = ""
        for chunk in chunks:
            received = superdense_encode_decode(chunk)
            decoded_message += received
            time.sleep(0.01)
        quantum_time = time.time() - start_quantum

        # --- 3. Calculate all metrics ---
        bits_total = len(message)
        classical_throughput = bits_total / classical_time if classical_time > 0 else float('inf')
        quantum_throughput = bits_total / quantum_time if quantum_time > 0 else float('inf')
        classical_bits_per_use = 1
        quantum_bits_per_use = 2
        classical_cost = 1.0
        quantum_cost = len(chunks) / bits_total if bits_total > 0 else 0
        
        # --- 4. Generate the plot and convert to base64 ---
        metrics = ["Throughput (bits/sec)", "Bits/use", "Resource Cost"]
        classical_values = [classical_throughput, classical_bits_per_use, classical_cost]
        quantum_values = [quantum_throughput, quantum_bits_per_use, quantum_cost]

        x = range(len(metrics))
        width = 0.35
        
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.bar([i - width/2 for i in x], classical_values, width, label="Classical")
        ax.bar([i + width/2 for i in x], quantum_values, width, label="Quantum (SDC)")
        
        ax.set_ylabel("Value")
        ax.set_title("Classical vs Superdense Coding Channel Comparison")
        ax.set_xticks(x)
        ax.set_xticklabels(metrics, rotation=20, ha="right")
        ax.legend()
        plt.tight_layout()
        
        # Save plot to an in-memory buffer
        img_buffer = io.BytesIO()
        plt.savefig(img_buffer, format="png")
        img_buffer.seek(0)
        
        # Encode the buffer's content to a base64 string
        graph_base64 = base64.b64encode(img_buffer.getvalue()).decode('utf-8')
        plt.close(fig) # Close the figure to free up memory

        # --- 5. Return everything in a single JSON response ---
        return jsonify({
            "input_message": message,
            "decoded_message": decoded_message,
            "classical_throughput": round(classical_throughput, 2),
            "quantum_throughput": round(quantum_throughput, 2),
            "classical_latency": round(classical_time, 4),
            "quantum_latency": round(quantum_time, 4),
            "classical_bits_per_use": classical_bits_per_use,
            "quantum_bits_per_use": quantum_bits_per_use,
            "classical_cost": classical_cost,
            "quantum_cost": round(quantum_cost, 2),
            "classical_reliability": 1.0, # Placeholder
            "quantum_reliability": 1.0, # Placeholder
            "graph": f"data:image/png;base64,{graph_base64}"
        })

    except Exception as e:
        # Return a server error if anything goes wrong
        return jsonify({"error": str(e)}), 500

# --- Standard entry point to run the Flask app ---
if __name__ == "__main__":
    # Use a port like 5004 to avoid conflicts with your React app's port
    app.run(debug=True, port=5004)