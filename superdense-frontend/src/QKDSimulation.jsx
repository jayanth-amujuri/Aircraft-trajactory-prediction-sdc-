import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Particles from './Particles';
import HoloToggle from './HoloToggle';
import config from './config';
import './QKDSimulation.css';

export default function QKDSimulation() {
  const navigate = useNavigate();
  const [numPairs, setNumPairs] = useState(50);
  const [simulateEve, setSimulateEve] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const runQKD = async (eveFlag) => {
    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch(
        `${config.application.baseURL}${config.application.endpoints.qkdSimulation}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ num_pairs: numPairs, eve: eveFlag }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setResults(data);
        if (!data.secure) {
          setError('⚠ Bell inequality not violated! Channel insecure.');
        }
      } else {
        setError(data.error || 'Failed to run QKD simulation');
      }
    } catch {
      setError('Network error: Unable to connect to backend');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunQKD = async () => runQKD(simulateEve);

  const handleGenerateSecureKey = async () => {
    setSimulateEve(false);
    await runQKD(false);
  };

  const handleProceedToSuperdense = () => {
    if (results) {
      localStorage.setItem('qkdKey', results.qkd_key);
      localStorage.setItem('qkdSecure', results.secure);

      navigate('/aircraft-navigation', {
        state: {
          qkdKey: results.qkd_key,
          qkdSecure: results.secure,
          sdcEve: simulateEve,
        },
      });
    }
  };

  return (
    <>
      <Particles
        particleCount={600}
        particleSpread={20}
        speed={0.4}
        particleColors={[
          '#667eea',
          '#764ba2',
          '#f093fb',
          '#22d3ee',
          '#a855f7',
          '#06b6d4',
          '#ff6b6b',
          '#4ecdc4',
        ]}
        moveParticlesOnHover
        particleHoverFactor={4}
        alphaParticles={false}
        particleBaseSize={120}
        sizeRandomness={1.2}
        cameraDistance={15}
      />

      <div className="qkd-page">
        <motion.div
          className="qkd-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >

          {/* HEADER */}
          <header className="qkd-header">
            <motion.h1 className="qkd-title">
              Quantum Key Distribution (E91 Protocol)
            </motion.h1>
            <motion.p className="qkd-subtitle">
              Secure key generation using CHSH Bell inequality violation.
            </motion.p>
          </header>

          {/* CONTROLS */}
          <motion.div className="controls-section">
            <div className="control-group">
              <label className="control-label">Number of Pairs:</label>
              <select
                value={numPairs}
                onChange={(e) => setNumPairs(parseInt(e.target.value))}
                className="control-select"
              >
                <option value={10}>10</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="control-group">
              <label className="control-label">Simulate Eve:</label>
              <HoloToggle checked={simulateEve} onChange={setSimulateEve} />
            </div>

            <button className="run-qkd-button" onClick={handleRunQKD} disabled={isLoading}>
              {isLoading ? 'Running E91 QKD...' : 'Run QKD'}
            </button>
          </motion.div>

          {error && <div className="error-message">❌ {error}</div>}

          {results && (
            <motion.div className="results-section">

              <h2 className="results-title">QKD Results</h2>

              <div className="results-grid">

                {/* QKD KEY */}
                <div className="result-card centered-card">
                  <h3>QKD Key</h3>
                  <div className="key-display">
                    {results.qkd_key.split('').map((bit, i) => (
                      <span key={i} className="key-bit">{bit}</span>
                    ))}
                  </div>
                  <p className="key-length">
                    Length: {results.qkd_key.length} bits
                  </p>
                </div>

                {/* CHSH S VALUE (REPLACED QBER) */}
                <div className="result-card centered-card">
                  <h3>CHSH S Value</h3>
                  <div className="s-value-display">
                    <span
                      className={
                        results.bell_violated
                          ? 's-value quantum'
                          : 's-value classical'
                      }
                    >
                      {Math.abs(results.S_value).toFixed(4)}

                    </span>
                  </div>
                  <p className="bell-status">
                    {results.bell_violated
                      ? '✅ Bell Inequality Violated (Quantum Secure)'
                      : '⚠ No Violation (Classical Limit)'}
                  </p>
                </div>

                {/* STATISTICS */}
                <div className="result-card centered-card">
                  <h3>Statistics</h3>
                  <div className="stats-list">
                    <div className="stat-item">
                      <span>Total Pairs</span>
                      <span>{results.total_pairs}</span>
                    </div>
                    <div className="stat-item">
                      <span>Sifted Bits</span>
                      <span>{results.sifted_bits_count}</span>
                    </div>
                    <div className="stat-item">
                      <span>Eve Present</span>
                      <span>{simulateEve ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>

              </div>

               {/* Measurement Table */}
              {results.alice_measurements &&
                results.bob_measurements && (
                  <div className="comparison-section">
                    <h3>
                        First 10 Measurements
                        <span className="key-basis-note">
                         (Key Basis: Alice 0° — Bob 22.5°)
                        </span>
                      </h3>

                    <table className="comparison-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Alice Angle</th>
                          <th>Alice Bit</th>
                          <th>Bob Angle</th>
                          <th>Bob Bit</th>
                          <th>Used For Key</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.alice_measurements
                          .slice(0, 10)
                          .map((alice, i) => {
                            const bob = results.bob_measurements[i];

                            const isKeyRound =
                              alice.angle === 0 &&
                              bob.angle === 22.5;

                            return (
                              <tr
                                key={i}
                                className={
                                  isKeyRound ? 'key-row' : ''
                                }
                              >
                                <td>{i + 1}</td>
                                <td>{alice.angle}°</td>
                                <td>{alice.bit}</td>
                                <td>{bob.angle}°</td>
                                <td>{bob.bit}</td>
                                <td>
                                  {isKeyRound ? '✔' : '—'}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}

              {!results.secure && (
                <div className="proceed-section">
                  <button className="run-qkd-button" onClick={handleGenerateSecureKey}>
                    Generate Secure Key
                  </button>
                </div>
              )}

              <div className="proceed-section">
                <button className="run-qkd-button" onClick={handleProceedToSuperdense}>
                  Proceed to SuperDense Coding
                </button>
              </div>

            </motion.div>
          )}

          <div className="navigation-section">
            <button onClick={() => navigate('/home')} className="back-button">
              ← Back to Home
            </button>
          </div>

        </motion.div>
      </div>
    </>
  );
}