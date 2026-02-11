// ComparisonNew.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import Particles from "./Particles";
import "./ComparisionNew.css";
import { motion } from "framer-motion";

export default function ComparisonNew() {
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ Get encryptedBinary from navigation state OR localStorage
  const encryptedBinary =
    location.state?.encryptedBinary ||
    localStorage.getItem("encryptedBinary");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // =====================================================
  // Fetch QEC comparison data
  // =====================================================
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");

      try {
        const bits = encryptedBinary
          ?.match(/.{1,2}/g)
          ?.slice(0, 33) || [];

        const response = await axios.post(
          "http://localhost:5008/compare33_corrected",
          {
            bits,
            shots: 1024,
            p_error: 0.1,
          }
        );

        setData(response.data);
      } catch (err) {
        setError("Failed to fetch channel analysis data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <>
      <Particles
        particleCount={350}
        particleSpread={12}
        speed={0.25}
        particleColors={["#38bdf8", "#818cf8", "#22d3ee"]}
        moveParticlesOnHover
        particleHoverFactor={2}
      />

      <div className="analysis-container">
        {/* ===================== HEADER ===================== */}
        <div className="channel-tabs">
          <span className="active">Classical Channel</span>
          <span>Quantum Channel (No QEC)</span>
          <span>Quantum (Shor QEC)</span>
        </div>

        <h1 className="analysis-title">Detailed Channel & Error Analysis</h1>
        <p className="analysis-subtitle">
          Understanding Performance & Error Correction Capabilities
        </p>

       
        {/* ===================== STATUS ===================== */}
        {loading && <p className="loading-text">⏳ Running simulations...</p>}
        {error && <p className="error-text">{error}</p>}

        {/* ===================== DATA VIEW ===================== */}
        {data && (
          <>
            {/* -------- METRIC TABLE -------- */}
            <div className="metric-table">
              <div className="row header">
                <div>Metric</div>
                <div>Classical</div>
                <div>Quantum (No QEC)</div>
                <div>Quantum (Shor QEC)</div>
              </div>

              <div className="row">
                <div>Bits per use</div>
                <div>1</div>
                <div>2</div>
                <div>2</div>
              </div>

              <div className="row">
                <div>Fidelity</div>
                <div>100%</div>
                <div>
                  {(
                    data.fidelities_noisy.reduce((a, b) => a + b, 0) /
                    data.fidelities_noisy.length
                  ).toFixed(2)}
                  %
                </div>
                <div>
                  {(
                    data.fidelities_shor.reduce((a, b) => a + b, 0) /
                    data.fidelities_shor.length
                  ).toFixed(2)}
                  %
                </div>
              </div>

              <div className="row">
                <div>Error tolerance</div>
                <div>None</div>
                <div>None</div>
                <div>1 Qubit</div>
              </div>

              <div className="row">
                <div>Noise impact</div>
                <div>High</div>
                <div>High</div>
                <div>Low</div>
              </div>

              <div className="row">
                <div>Resource cost</div>
                <div>Low</div>
                <div>Medium</div>
                <div>Medium</div>
              </div>
            </div>

            {/* -------- GRAPH -------- */}
            <h2 className="section-title">Average Fidelity Bar Graph Comparison</h2>

            <div className="graph-box">
              <img
                src={`data:image/png;base64,${data.fidelity_graph}`}
                alt="Fidelity bar graph comparision"
              />
              <p className="graph-caption">
                Bar graph showing average fidelity across all messages for each method. 
                Shor QEC significantly improves performance under single-qubit depolarizing noise.
              </p>
            </div>

            
           
            {/* -------- CLASSICAL VS QUANTUM COMPARISON BUTTON -------- */}
            {/* {encryptedBinary && ( */}
              <motion.div className="comparison-section" style={{textAlign: 'center', marginTop: '24px', display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap'}}>
                <motion.button
                  className="comparision-button"
                  onClick={() => navigate('/comparision', { state: { encryptedBinary: encryptedBinary } })}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    marginBottom: '16px',
                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
                    transition: 'all 0.3s ease',
                    minWidth: '240px'
                  }}
                >
                  📊 Compare Classical vs Quantum
                </motion.button>
              </motion.div>
            {/* )} */}
          </>
        )}
      </div>
    </>
  );
}
