# Hardware-only Bell state on IBM Quantum with SamplerV2 (no simulator)

from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister
from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2 as Sampler
from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
from qiskit.visualization import plot_histogram
from IPython.display import display

# --- Connect (token must have been saved once via save_account) ---
service = QiskitRuntimeService(
    channel="ibm_quantum_platform",
    instance="crn:v1:bluemix:public:quantum-computing:us-east:a/c963c3666fc146bfa5a8b0cf1fc2d38a:d45e06b8-e294-4181-97c2-6d204a4bcbbd::"  # from IBM Quantum account page
)

# --- Pick a real device (no simulator) ---
backend = service.least_busy(simulator=False, operational=True)
print("Using backend:", backend.name)

# --- Build Bell circuit with a NAMED classical register ---
q = QuantumRegister(2, "q")
c = ClassicalRegister(2, "c")  # we'll read results from this name ("c")
qc = QuantumCircuit(q, c)
qc.h(q[0])
qc.cx(q[0], q[1])
qc.measure(q, c)

# Show circuit
display(qc.draw("mpl"))

# --- Transpile to the device ISA (required by V2 primitives) ---
pm = generate_preset_pass_manager(backend=backend, optimization_level=1)
isa_circ = pm.run(qc)

# --- Run with Sampler V2 (shots here; no simulator path) ---
SHOTS = 1024
sampler = Sampler(backend)
job = sampler.run([isa_circ], shots=SHOTS)
print("Job ID:", job.job_id())

# --- Fetch counts from the PUB result using the classical register name ---
res = job.result()
pub = res[0]
counts = getattr(pub.data, c.name).get_counts()  # -> dict like {"00": N, "11": N, ...}

# Plot
display(plot_histogram(counts, title=f"Bell state on {backend.name}"))