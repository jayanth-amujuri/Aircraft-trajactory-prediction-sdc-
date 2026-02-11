// src/IbmCloud.jsx
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./IbmCloud.css";

export default function IbmCloud() {
  const location = useLocation();
  const navigate = useNavigate();

  // --- State for inputs ---
  const [latitude, setLatitude] = useState("33.89729");
  const [longitude, setLongitude] = useState("74.24314");
  const [restrictedStatus, setRestrictedStatus] = useState("0");

  // --- State for API interaction ---
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // --- State for debug/binary display ---
  const [binaryLat, setBinaryLat] = useState("");
  const [binaryLon, setBinaryLon] = useState("");
  const [chunks, setChunks] = useState([]);

  // --- Effect to receive state from navigation ---
  useEffect(() => {
    if (location.state) {
      setLatitude(location.state.latitude?.toString() || "33.89729");
      setLongitude(location.state.longitude?.toString() || "74.24314");
      setRestrictedStatus(location.state.restrictedStatus === "Yes" ? "1" : "0");
    }
  }, [location.state]);

  // --- Convert decimal to fixed-length binary string ---
  const toBinary = (num, bits = 32) => {
    // Match the backend's precision (1e5) and bit length (32)
    const intVal = Math.round(parseFloat(num) * 1e5);
    let binStr = (intVal >>> 0).toString(2); // convert to unsigned binary
    return binStr.padStart(bits, "0");
  };

  // --- Split binary string into 2-bit chunks ---
  const splitIntoChunks = (binStr) => {
    const chunkList = [];
    for (let i = 0; i < binStr.length; i += 2) {
      chunkList.push(binStr.slice(i, i + 2));
    }
    return chunkList;
  };

  // --- Send data via Superdense Coding ---
  const handleSend = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setBinaryLat("");
    setBinaryLon("");
    setChunks([]);

    try {
      // --- Convert lat/lon to binary for display ---
      const latBin = toBinary(latitude);
      const lonBin = toBinary(longitude);
      setBinaryLat(latBin);
      setBinaryLon(lonBin);

      // --- Combine and split into 2-bit chunks ---
      // Note: The backend will create its own binary string. This is for UI display only.
      const combinedBin = latBin + lonBin + (restrictedStatus === "1" ? "1" : "0");
      const chunkList = splitIntoChunks(combinedBin);
      setChunks(chunkList);

      // --- Call backend ---
      const url = `http://localhost:5005/sdc/send?latitude=${latitude}&longitude=${longitude}&restricted_status=${restrictedStatus}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);

    } catch (err) {
      setError(err.message || "An unknown error occurred.");
      console.error("Request failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- Copy Job IDs to clipboard ---
  const handleCopyJobIds = () => {
    if (!result?.job_ids) return;
    const pythonList = JSON.stringify(result.job_ids);
    navigator.clipboard.writeText(pythonList);
    alert("✅ Job IDs copied to clipboard:\n" + pythonList);
  };

  // --- Redirect to Receiver page ---
  const handleReceive = () => {
    navigate("/receiver");
  };

  return (
    <div className="ibm-cloud-page">
      <h1>Superdense Coding - IBM Quantum Interface</h1>

      <div className="sdc-form">
        <div className="display-field">
          <label>Latitude:</label>
          <span>{latitude}</span>
        </div>
        <div className="display-field">
          <label>Longitude:</label>
          <span>{longitude}</span>
        </div>
        <div className="display-field">
          <label>Restricted Status:</label>
          <span>{restrictedStatus === "1" ? "Restricted" : "Not Restricted"}</span>
        </div>

        <div className="buttons" style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
          <button className="send-btn" onClick={handleSend} disabled={loading}>
            {loading ? "Submitting Jobs..." : "Send Data via Superdense Coding"}
          </button>

          <button className="receive-btn" onClick={handleReceive}>
            Receive via Superdense Coding
          </button>
        </div>
      </div>

      {error && <div className="error">❌ Error: {error}</div>}

      {binaryLat && binaryLon && (
        <div className="binary-display">
          <h3>🛰 Binary Representation</h3>
          <p><strong>Latitude Binary:</strong> {binaryLat}</p>
          <p><strong>Longitude Binary:</strong> {binaryLon}</p>
          <h4>Chunks (2-bit each):</h4>
          <div className="chunks-container">
            {chunks.map((c, idx) => (
              <span key={idx} className="chunk-box">{c}</span>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="sdc-result">
          <h2>✅ Jobs Submitted Successfully</h2>
          <p>
            The following quantum circuits have been submitted to the IBM backend.
            Job IDs are stored in MongoDB and can be used to retrieve results later.
          </p>

          <div className="result-item">
            <strong>IBM Quantum Job IDs:</strong>
            <ul>
              {result.job_ids.map((id, index) => (
                <li key={index}>{id}</li>
              ))}
            </ul>

            <button className="copy-btn" onClick={handleCopyJobIds}>
              Copy Job IDs (Python List)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}