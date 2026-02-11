# errorcorrection.py
import random
import matplotlib.pyplot as plt
import io
import base64

from flask import Flask, request, jsonify
from flask_cors import CORS

from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister, transpile
from qiskit_aer import AerSimulator
from qiskit_aer.noise import NoiseModel, depolarizing_error
import matplotlib
matplotlib.use("Agg")  # non-GUI backend (SAFE for Flask)



# =====================================================
# Noise Model
# =====================================================
def make_single_qubit_noise_model(p_error, affected_qubits):
    """
    Single-qubit depolarizing noise.
    
    Error probability:
        p_error per gate (id, x, y, z)
        
    Error applied:
        X, Y, or Z with equal probability
        
    Applied only to selected qubits.
    """
    noise_model = NoiseModel()
    error = depolarizing_error(p_error, 1)

    for q in affected_qubits:
        for gate in ["id", "x", "y", "z"]:
            noise_model.add_quantum_error(error, gate, [q])

    return noise_model


# =====================================================
# Shor 9-qubit Encode / Decode
# =====================================================
def shor_encode(qc, data_qubit):
    # Bit-flip protection
    qc.cx(data_qubit, data_qubit + 3)
    qc.cx(data_qubit, data_qubit + 6)

    # Phase-flip protection
    for i in range(3):
        t = data_qubit + 3 * i
        qc.h(t)
        qc.cx(t, t + 1)
        qc.cx(t, t + 2)


def shor_decode(qc, data_qubit):
    # Phase-flip correction
    for i in range(3):
        t = data_qubit + 3 * i
        qc.cx(t, t + 2)
        qc.cx(t, t + 1)
        qc.h(t)

    # Bit-flip correction
    qc.cx(data_qubit, data_qubit + 6)
    qc.cx(data_qubit, data_qubit + 3)
    qc.ccx(data_qubit + 6, data_qubit + 3, data_qubit)


# =====================================================
# Standard Superdense Coding (no QEC)
# =====================================================
def standard_sdc(msg):
    qc = QuantumCircuit(2, 2)

    qc.h(0)
    qc.cx(0, 1)

    if msg == "01":
        qc.z(0)
    elif msg == "10":
        qc.x(0)
    elif msg == "11":
        qc.x(0)
        qc.z(0)

    qc.cx(0, 1)
    qc.h(0)

    qc.measure([0, 1], [0, 1])
    return qc


# =====================================================
# Shor-protected Superdense Coding
# =====================================================
def shor_sdc(msg):
    qr = QuantumRegister(10, "q")   # 9 for Shor + 1 Bob
    cr = ClassicalRegister(2, "c")
    qc = QuantumCircuit(qr, cr)

    alice = 0
    bob = 9

    # Bell pair
    qc.h(alice)
    qc.cx(alice, bob)

    # Encode message
    if msg == "01":
        qc.z(alice)
    elif msg == "10":
        qc.x(alice)
    elif msg == "11":
        qc.x(alice)
        qc.z(alice)

    # Shor encoding
    shor_encode(qc, alice)

    # Identity gates (noise injection points)
    for q in range(9):
        qc.id(q)

    # Shor decoding
    shor_decode(qc, alice)

    # SDC decode
    qc.cx(alice, bob)
    qc.h(alice)

    qc.measure([alice, bob], [0, 1])
    return qc


# =====================================================
# Flask App
# =====================================================
app = Flask(__name__)
CORS(app)


@app.route("/compare33_corrected", methods=["POST"])
def compare_33_corrected():
    data = request.json
    bits = data.get("bits", ["00"] * 33)
    shots = data.get("shots", 1024)
    p_error = data.get("p_error", 0.1)

    fidelities_ideal = []
    fidelities_noisy = []
    fidelities_shor = []

    corrected_messages = []

    # SAME noise strength for both cases
    noisy_qubits_standard = [0]              # logical qubit
    noisy_qubits_shor = random.sample(range(0, 9), 1)  # SAME: only 1 physical qubit noisy

    for msg in bits:

        # ---------------- IDEAL ----------------
        qc_ideal = standard_sdc(msg)
        sim_ideal = AerSimulator()
        counts_ideal = sim_ideal.run(
            transpile(qc_ideal, sim_ideal),
            shots=shots
        ).result().get_counts()

        fidelities_ideal.append(counts_ideal.get(msg, 0) / shots * 100)


        # ---------------- NOISY (NO QEC) ----------------
        qc_noisy = standard_sdc(msg)
        noise_no_qec = make_single_qubit_noise_model(
            p_error,
            noisy_qubits_standard
        )

        sim_noisy = AerSimulator(noise_model=noise_no_qec)
        counts_noisy = sim_noisy.run(
            transpile(qc_noisy, sim_noisy),
            shots=shots
        ).result().get_counts()

        fidelities_noisy.append(counts_noisy.get(msg, 0) / shots * 100)


        # ---------------- SHOR QEC ----------------
        qc_shor = shor_sdc(msg)
        noise_shor = make_single_qubit_noise_model(
            p_error,
            noisy_qubits_shor
        )

        sim_shor = AerSimulator(noise_model=noise_shor)
        counts_shor = sim_shor.run(
            transpile(qc_shor, sim_shor),
            shots=shots
        ).result().get_counts()

        fidelities_shor.append(counts_shor.get(msg, 0) / shots * 100)

        max_msg = max(counts_shor, key=counts_shor.get)
        corrected_messages.append({
            "corrected_message": max_msg,
            "fidelity": counts_shor.get(msg, 0) / shots * 100
        })


    # ---------------- PLOT ----------------
    fig, ax = plt.subplots(figsize=(10, 6))
    
    # Calculate average fidelities for each method
    avg_ideal = sum(fidelities_ideal) / len(fidelities_ideal)
    avg_noisy = sum(fidelities_noisy) / len(fidelities_noisy)
    avg_shor = sum(fidelities_shor) / len(fidelities_shor)
    
    methods = ['Ideal', 'Noisy\n(No QEC)', 'Shor QEC']
    avg_fidelities = [avg_ideal, avg_noisy, avg_shor]
    colors = ['#2ecc71', '#e74c3c', '#3498db']
    
    # Create bar graph
    bars = ax.bar(methods, avg_fidelities, color=colors, alpha=0.8, edgecolor='black', linewidth=1.5)
    
    # Add value labels on top of bars
    for bar, fidelity in zip(bars, avg_fidelities):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height + 1,
                f'{fidelity:.1f}%', ha='center', va='bottom', fontweight='bold', fontsize=12)
    
    ax.set_ylabel("Average Fidelity (%)", fontsize=12, fontweight='bold')
    ax.set_title(
        f"Fair Comparison: Same Error Probability (p={p_error}), Same Noisy Qubits (1)",
        fontsize=14, fontweight='bold', pad=20
    )
    ax.set_ylim(0, max(avg_fidelities) + 10)
    ax.grid(True, alpha=0.3)
    
    # Style the plot
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.tick_params(axis='both', which='major', labelsize=11)

    buf = io.BytesIO()
    plt.savefig(buf, format="png")
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode("utf-8")
    plt.close(fig)

    return jsonify({
        "fidelities_ideal": fidelities_ideal,
        "fidelities_noisy": fidelities_noisy,
        "fidelities_shor": fidelities_shor,
        "corrected_messages": corrected_messages,
        "fidelity_graph": img_base64
    })


if __name__ == "__main__":
    app.run(debug=True, port=5008)
