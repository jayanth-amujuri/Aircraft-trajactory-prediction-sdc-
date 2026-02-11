# superdense_full_analysis.py
# Simulate Superdense Coding (SDC) with and without an Eve (intercept-resend).
# Qiskit 1.x compatible
# pip install qiskit qiskit-aer numpy

import numpy as np
from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister
from qiskit_aer import AerSimulator
from qiskit.quantum_info import Statevector, DensityMatrix

def build_sdc_full_circuit(message: str, eve_mode: str = None):
    """Builds the complete SDC circuit with measurements for simulation."""
    if message not in {'00', '01', '10', '11'}:
        raise ValueError("message must be '00', '01', '10', or '11'")

    q = QuantumRegister(2, 'q')
    c = ClassicalRegister(2, 'c')
    circ = QuantumCircuit(q, c)

    # --- Part 1: Entanglement ---
    circ.h(q[0])
    circ.cx(q[0], q[1])
    circ.barrier(label="Entangle")

    # --- Alice encodes her 2 classical bits on q0 ---
    if message == '01':
        circ.x(q[0])
    elif message == '10':
        circ.z(q[0])
    elif message == '11':
        circ.z(q[0]); circ.x(q[0])
    circ.barrier(label="Encode")

    # --- Eve intercepts q0, measures in Z, and resends ---
    if eve_mode == 'measure_and_resend':
        e = ClassicalRegister(1, 'e')
        circ.add_register(e)
        circ.measure(q[0], e[0])
        # If Eve saw |1>, she resends |1> (apply X conditionally)
        circ.x(q[0]).c_if(e, 1)
        circ.barrier(label="Eve Attack")

    # --- Bob decodes ---
    circ.cx(q[0], q[1])
    circ.h(q[0])
    circ.barrier(label="Decode")

    # --- Final readout (Bob expects to get Alice's two bits) ---
    circ.measure(q[0], c[0])  # LSB
    circ.measure(q[1], c[1])  # MSB

    return circ

def build_sdc_unitary_part(message: str):
    """Builds only the unitary part (no classical registers/measurements) for state analysis."""
    q = QuantumRegister(2, 'q')
    circ = QuantumCircuit(q)
    circ.h(q[0])
    circ.cx(q[0], q[1])
    if message == '01':
        circ.x(q[0])
    elif message == '10':
        circ.z(q[0])
    elif message == '11':
        circ.z(q[0]); circ.x(q[0])
    return circ

def run_simulation(full_circuit: QuantumCircuit, message: str, shots=1024, seed=1234):
    """Runs the simulation and returns processed counts and success rate."""
    backend = AerSimulator(seed_simulator=seed)
    job = backend.run(full_circuit, shots=shots)
    counts = job.result().get_counts(full_circuit)

    # Map counts to '00','01','10','11' in message order (c[0] is LSB, c[1] is MSB)
    remapped = {'00': 0, '01': 0, '10': 0, '11': 0}
    for k, v in counts.items():
        # k is a bitstring like 'c1c0' (MSB…LSB). Rearrange to LSB→MSB order for readability.
        # Our message string is 'b1b0' with b0=on q0, b1=on q1. So reverse:
        remapped[k[::-1]] += v

    success_rate = remapped.get(message, 0) / shots
    return remapped, success_rate

def display_simulation_results(message, remapped_counts, success_rate, label):
    """Prints the circuit and simulation results."""
    print(f"\n--- {label} (Message: {message}) ---")
    print("Decoded counts:")
    for bits in ('00', '01', '10', '11'):
        count = remapped_counts.get(bits, 0)
        if count > 0:
            print(f"  '{bits}': {count}")
    print(f"Success rate: {success_rate:.2%}")

def display_state_analysis(message):
    """Calculates and displays the Statevector and Density Matrix analysis."""
    print("\n--- Quantum State Analysis ---")

    # --- No Eve: pure entangled state after Alice's encode ---
    qc_unitary_no_eve = build_sdc_unitary_part(message)
    sv_no_eve = Statevector.from_instruction(qc_unitary_no_eve)
    dm_no_eve = DensityMatrix(sv_no_eve)

    print(f"1. Statevector (No Eve, Message '{message}'):")
    sv_dict = sv_no_eve.to_dict()  # basis labels like '00','01',...
    for basis, amp in sv_dict.items():
        # compact complex formatting
        re = np.real(amp)
        im = np.imag(amp)
        print(f"   |{basis}> : {re:+.3f}{im:+.3f}j")
    print("   (Pure, entangled Bell-like state)")

    # --- With Eve: projective Z measurement on q0 (discard outcome) → classical mixture ---
    P0 = np.array([[1, 0], [0, 0]], dtype=complex)
    P1 = np.array([[0, 0], [0, 1]], dtype=complex)
    I = np.eye(2, dtype=complex)

    # Full 2-qubit operators: P0 ⊗ I and P1 ⊗ I
    M0 = np.kron(P0, I)
    M1 = np.kron(P1, I)

    rho = dm_no_eve.data
    dm_after_eve = M0 @ rho @ M0.conj().T + M1 @ rho @ M1.conj().T

    print(f"\n2. Density Matrix (After Eve's Attack, Message '{message}'):")
    with np.printoptions(precision=3, suppress=True):
        print(dm_after_eve)
    print("   (Mixed state: off-diagonals (coherence) are suppressed by Eve’s measurement.)")
    print("-" * 35)

def demo_all(shots=4096):
    """Runs the full demo for all messages and both Eve scenarios."""
    print("🚀 Starting Superdense Coding Full Analysis...")

    for msg in ('00', '01', '10', '11'):
        # --- No Eve ---
        qc_full_no_eve = build_sdc_full_circuit(msg, eve_mode=None)
        counts_no_eve, rate_no_eve = run_simulation(qc_full_no_eve, msg, shots)
        display_simulation_results(msg, counts_no_eve, rate_no_eve, "Simulation: No Eve")
        print("Circuit Diagram:")
        print(qc_full_no_eve.draw(output='text', cregbundle=False))

        # --- With Eve ---
        qc_full_eve = build_sdc_full_circuit(msg, eve_mode='measure_and_resend')
        counts_eve, rate_eve = run_simulation(qc_full_eve, msg, shots)
        display_simulation_results(msg, counts_eve, rate_eve, "Simulation: With Eve")
        print("Circuit Diagram:")
        print(qc_full_eve.draw(output='text', cregbundle=False))

        # --- State analysis (no measurements) ---
        display_state_analysis(msg)

    print("\n✨ Simulation complete.")

if __name__ == "__main__":
    demo_all()