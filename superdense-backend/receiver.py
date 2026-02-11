import os
import json
from flask import Flask, jsonify, Response, stream_with_context
from flask_cors import CORS
from pymongo import MongoClient
from urllib.parse import quote_plus
from qiskit_ibm_runtime import QiskitRuntimeService
from dotenv import load_dotenv
import certifi

# --- Flask Setup ---
app = Flask(__name__)
CORS(app)

# --- IBM Quantum Config ---
load_dotenv()
TOKEN = os.getenv("IBM_TOKEN")
INSTANCE = os.getenv("IBM_INSTANCE")

if not TOKEN or not INSTANCE:
    print("❌ Missing IBM credentials in .env or in the script.")
    exit()

try:
    print("🔗 Connecting to IBM Quantum as Bob...")
    service = QiskitRuntimeService(channel="ibm_quantum_platform", token=TOKEN, instance=INSTANCE)
    print("✅ Connected to IBM Quantum.\n")
except Exception as e:
    print(f"❌ Connection failed: {e}")
    exit()

# --- MongoDB Atlas Config ---
username = os.getenv("MONGO_USER")
password = quote_plus(os.getenv("MONGO_PASSWORD"))
cluster_url = os.getenv("MONGO_CLUSTER_URL")
MONGO_URI = f"mongodb+srv://{username}:{password}@{cluster_url}/?retryWrites=true&w=majority"
client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
db = client.quantum_jobs
collection = db.jobs
print("✅ Connected to MongoDB Atlas.\n")

# --- Helper: Convert two's complement binary string to int ---
def twos_complement_to_int(bin_str: str) -> int:
    bits = len(bin_str)
    if bits == 0:
        return 0
    if bin_str[0] == '1':  # negative number
        return int(bin_str, 2) - (1 << bits)
    return int(bin_str, 2)

# --- Flask Route to stream job progress ---
@app.route("/sdc/receive-stream", strict_slashes=False)
def receive_sdc_stream():
    def generate_progress():
        try:
            # Helper to yield formatted SSE data
            def yield_event(data):
                yield f"data: {json.dumps(data)}\n\n"

            print("📥 Fetching pending jobs from MongoDB...")
            pending_jobs = list(collection.find({"status": "pending"}))
            print(f"  ➡ Found {len(pending_jobs)} pending jobs.")

            if not pending_jobs:
                yield from yield_event({"type": "error", "message": "No pending jobs found."})
                return

            pending_jobs.sort(key=lambda doc: doc['_id'].generation_time)
            
            total_jobs = len(pending_jobs)
            yield from yield_event({"type": "start", "total_jobs": total_jobs})

            full_binary = ""
            job_ids_processed = []

            for idx, job_doc in enumerate(pending_jobs):
                job_id = job_doc["job_id"]
                job_ids_processed.append(job_id)
                
                progress_data = {
                    "type": "progress",
                    "job_id": job_id,
                    "current_job": idx + 1,
                    "total_jobs": total_jobs,
                    "message": "Retrieving result from IBM Quantum..."
                }
                yield from yield_event(progress_data)

                try:
                    job = service.job(job_id)
                    result = job.result(timeout=600)

                    creg_data = next(iter(result[0].data.values()))
                    counts = creg_data.get_counts()

                    if not counts:
                        raise ValueError("Counts dictionary is empty.")

                    most_probable = max(counts, key=counts.get)
                    full_binary += most_probable
                    
                    progress_data["message"] = f"Success! Decoded bits: {most_probable}"
                    progress_data["status"] = "success"
                    yield from yield_event(progress_data)
                    
                    collection.update_one(
                        {"_id": job_doc["_id"]},
                        {"$set": {"status": "completed"}}
                    )
                except Exception as e:
                    error_message = f"Job {job_id} failed: {str(e)}"
                    print(f"  ⚠ {error_message}")
                    progress_data["message"] = str(e)
                    progress_data["status"] = "error"
                    yield from yield_event(progress_data)
                    
                    collection.update_one(
                        {"_id": job_doc["_id"]},
                        {"$set": {"status": "error", "error_message": str(e)}}
                    )
                    continue

            if not full_binary:
                yield from yield_event({"type": "error", "message": "No valid results decoded."})
                return

            # --- Final decoding ---
            status_bit = full_binary[-1]
            body = full_binary[:-1]
            
            # Use fixed 32-bit allocation from the sender
            LAT_BITS, LON_BITS = 32, 32
            lat_bin = body[:LAT_BITS]
            lon_bin = body[LAT_BITS:LAT_BITS + LON_BITS]

            lat = twos_complement_to_int(lat_bin) / 1e5
            lon = twos_complement_to_int(lon_bin) / 1e5
            restricted_status = "Restricted" if status_bit == "1" else "Not Restricted"

            final_result = {
                "latitude": lat,
                "longitude": lon,
                "restricted_status": restricted_status,
                "full_binary": full_binary
            }
            yield from yield_event({"type": "done", "result": final_result})

        except Exception as e:
            print(f"❌ Fatal error in stream: {e}")
            yield from yield_event({"type": "error", "message": str(e)})

    return Response(stream_with_context(generate_progress()), mimetype="text/event-stream")

if __name__ == "__main__":
    print("🚀 Starting Flask receiver server on http://0.0.0.0:5006")
    # app.run(host="0.0.0.0", port=5006, debug=True)
    app.run(
        host="0.0.0.0",
        port=5006,
        debug=False,       # ❗ REQUIRED
        use_reloader=False # ❗ REQUIRED
    )