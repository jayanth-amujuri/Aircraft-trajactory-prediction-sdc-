import os
import base64
import io
from flask import Flask, request, jsonify
from flask_cors import CORS
import matplotlib
import matplotlib.pyplot as plt

print("Checkpoint 1: Importing Qiskit libraries...")
from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister
from qiskit_aer import AerSimulator
from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2 as Sampler
from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
from qiskit.visualization import plot_histogram
print("Checkpoint 2: Qiskit libraries imported successfully.")

matplotlib.use('Agg')

# --- Flask App Initialization ---
app = Flask(__name__)
CORS(app)

def fig_to_base64(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format='png', bbox_inches='tight')
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode('utf-8')

def run_local_simulation(message: str, shots: int = 1024):
    print("--- Running Local Simulation ---")
    q = QuantumRegister(2, 'q')
    c = ClassicalRegister(2, 'c')
    circ = QuantumCircuit(q, c)
    
    circ.h(q[0]); circ.cx(q[0], q[1]); circ.barrier()
    if message == '01': circ.x(q[0])
    elif message == '10': circ.z(q[0])
    elif message == '11': circ.z(q[0]); circ.x(q[0])
    circ.barrier()
    circ.cx(q[0], q[1]); circ.h(q[0]); circ.barrier()
    circ.measure(q[0], c[0]); circ.measure(q[1], c[1])

    backend = AerSimulator()
    job = backend.run(circ, shots=shots)
    counts = job.result().get_counts(circ)

    # Fix endian by reversing keys
    remapped = {'00': 0, '01': 0, '10': 0, '11': 0}
    for k, v in counts.items():
        remapped[k[::-1]] += v
    success_rate = remapped.get(message, 0) / shots

    circuit_fig = circ.draw(output='mpl', style='iqp')
    hist_fig = plot_histogram(remapped, title=f"Local Simulation (Message: {message})")

    return {
        "counts": remapped,
        "success_rate": success_rate,
        "circuit_image_b64": fig_to_base64(circuit_fig),
        "histogram_image_b64": fig_to_base64(hist_fig),
    }


def run_ibm_simulation(message: str, shots: int = 1024):
    print("--- Running IBM Simulation ---")
    try:
        IBM_QUANTUM_TOKEN = os.getenv("IBM_QUANTUM_TOKEN", "3NRmxBr_QjMOripw2wJxbCu5xfrQJzfMD6bcdDdjBwek")
        IBM_INSTANCE = os.getenv("IBM_INSTANCE", "crn:v1:bluemix:public:quantum-computing:us-east:a/e19be33e2fbd4fa192faa47e0ee38f57:fcf7029c-b7e6-4434-bff0-e11cb4bba14a::")

        service = QiskitRuntimeService(channel="ibm_cloud",
                                       token=IBM_QUANTUM_TOKEN,
                                       instance=IBM_INSTANCE)
        backend = service.least_busy(simulator=False, operational=True)
        print(f"Using backend: {backend.name}")
    except Exception as e:
        print(f"ERROR during IBM connection: {e}")
        return {"error": f"IBM Quantum Connection Error: {str(e)}"}

    q = QuantumRegister(2, "q")
    c = ClassicalRegister(2, "c")
    qc = QuantumCircuit(q, c)

    qc.h(q[0]); qc.cx(q[0], q[1])
    if message == "01": qc.x(q[0])
    elif message == "10": qc.z(q[0])
    elif message == "11": qc.z(q[0]); qc.x(q[0])
    qc.cx(q[0], q[1]); qc.h(q[0]); qc.measure(q, c)

    pm = generate_preset_pass_manager(backend=backend, optimization_level=1)
    isa_circ = pm.run(qc)

    sampler = Sampler(backend)
    job = sampler.run([isa_circ], shots=shots)
    job_id = job.job_id()
    res = job.result()
    pub = res[0]

    counts_raw = getattr(pub.data, c.name).get_counts()

    counts = {'00': 0, '01': 0, '10': 0, '11': 0}
    for k, v in counts_raw.items():
        counts[k[::-1]] += v

    circuit_fig = qc.draw(output='mpl', style='iqp', idle_wires=False)
    hist_fig = plot_histogram(counts, title=f"IBM Backend: {backend.name} (Message: {message})")

    return {
        "job_id": job_id,
        "backend_name": backend.name,
        "counts": counts,
        "circuit_image_b64": fig_to_base64(circuit_fig),
        "histogram_image_b64": fig_to_base64(hist_fig),
    }


@app.route('/api/run_simulation', methods=['POST'])
def run_simulation_endpoint():
    try:
        data = request.get_json()
        message = data.get('message')
        target = data.get('target')

        if not message or message not in ['00', '01', '10', '11']:
            return jsonify({"error": "Invalid message provided."}), 400
        if not target or target not in ['local', 'ibm']:
            return jsonify({"error": "Invalid target provided."}), 400
        
        if target == 'local':
            result = run_local_simulation(message)
        else:
            result = run_ibm_simulation(message)
        
        return jsonify(result)

    except Exception as e:
        return jsonify({"error": f"Unexpected server error: {str(e)}"}), 500


if __name__ == '__main__':
    print("Starting Flask server...")
    app.run(debug=False, port=5000)