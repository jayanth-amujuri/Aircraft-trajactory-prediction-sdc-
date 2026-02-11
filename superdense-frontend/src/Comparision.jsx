// Comparison.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import Particles from './Particles';
import "./Comparision.css";

export default function Comparison() {
  const location = useLocation();
  const navigate = useNavigate();
  // const { encryptedBinary } = location.state || {}; 
  const encryptedBinary =
    location.state?.encryptedBinary ||
    localStorage.getItem("encryptedBinary");


  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const fetchComparison = async () => {
    if (!encryptedBinary || !/^[01]+$/.test(encryptedBinary)) {
      setError("Invalid encrypted binary received for comparison");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      console.log('Sending request to /compare with data:', { message: encryptedBinary });
      const response = await axios.post("http://localhost:5004/compare", {
        message: encryptedBinary,
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000 // 30 seconds timeout
      });

      console.log('Received response:', response.data);
      
      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setResult(response.data);
    } catch (err) {
      console.error('Error fetching comparison data:', err);
      setError(err.response?.data?.error || err.message || "Failed to fetch comparison data. Please try again.");
    } finally {
      setLoading(false);
    }
    };

    fetchComparison();
  }, [encryptedBinary]);

  useEffect(() => {
    if (!result) return;

    const updateDimensions = () => {
      const container = document.querySelector('.graph-container');
      if (!container) return;

      const containerWidth = container.clientWidth;
      const containerHeight = 400; // Fixed height for the graph

      // Calculate width with padding
      const padding = 40;
      const width = Math.max(containerWidth - padding * 2, 300);

      // Only update if dimensions actually changed
      if (width !== dimensions.width || containerHeight !== dimensions.height) {
        setDimensions({
          width,
          height: containerHeight
        });
      }
    };

    // Initial update
    updateDimensions();

    // Debounce resize events
    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateDimensions, 100);
    };

    // Set up event listeners
    window.addEventListener('resize', handleResize);

    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, [result, dimensions]);

  return (
    <>
      <Particles
        particleCount={400}
        particleSpread={15}
        speed={0.3}
        particleColors={['#667eea', '#764ba2', '#f093fb', '#22d3ee', '#a855f7', '#06b6d4']}
        moveParticlesOnHover
        particleHoverFactor={3}
        alphaParticles={false}
        particleBaseSize={100}
        sizeRandomness={1.0}
        cameraDistance={20}
      />
      
      <div className="comparison-container">
      <h1 className="comparison-title">
        Classical vs Quantum Channel Comparison
      </h1>

      {!encryptedBinary && (
        <p className="error-text">⚠ No encrypted binary received!</p>
      )}

      {loading && <p className="loading-text">⏳ Processing...</p>}
      {error && <p className="error-text">{error}</p>}

      {result && (
        <div className="results-card">
          <h2 className="results-title">📊 Results</h2>

          {/* Encrypted Message */}
          <p className="encrypted-message">
            <strong>Encrypted Message:</strong> {result.input_message}
          </p>

          {/* Classical Results Row */}
          <h3 className="section-title">🔷 Classical Communication</h3>
          <div className="results-row">
            <p>
              <strong>Throughput:</strong> {result.classical_throughput} bits/sec
            </p>
            <p>
              <strong>Latency:</strong> {result.classical_latency} sec
            </p>
            <p>
              <strong>Bits/Use:</strong> {result.classical_bits_per_use}
            </p>
            <p>
              <strong>Cost:</strong> {result.classical_cost}
            </p>
          </div>

          {/* Quantum Results Row */}
          <h3 className="section-title">⚛️ Quantum Communication</h3>
          <div className="results-row">
            <p>
              <strong>Throughput:</strong> {result.quantum_throughput} bits/sec
            </p>
            <p>
              <strong>Latency:</strong> {result.quantum_latency} sec
            </p>
            <p>
              <strong>Bits/Use:</strong> {result.quantum_bits_per_use}
            </p>
            <p>
              <strong>Cost:</strong> {result.quantum_cost}
            </p>
          </div>

          <h3 className="graph-title">📊 Performance Comparison</h3>
          <div className="graph-container">
            {result?.graph ? (
              <img 
                src={typeof result.graph === 'string' && !result.graph.startsWith('data:image/') 
                  ? `data:image/png;base64,${result.graph}` 
                  : result.graph} 
                alt="Performance Comparison" 
                className="graph-image"
                onError={(e) => {
                  console.error('Error loading graph image');
                  e.target.style.display = 'none';
                  const fallback = document.querySelector('.graph-fallback');
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            <div className="graph-fallback" style={{ display: result?.graph ? 'none' : 'flex' }}>
              <p>Generating comparison chart...</p>
              <div className="graph-placeholder">
                <div className="graph-loading-animation"></div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Home Button */}
      <div className="navigation-section">
        <button 
          onClick={() => navigate('/navigation')} 
          className="home-button"
        >
          🏠 Home
        </button>
      </div>
    </div>
    </>
  );
}