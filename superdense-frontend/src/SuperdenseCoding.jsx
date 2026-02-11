// SuperdenseCoding.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Particles from './Particles';
import HoloToggle from './HoloToggle';
import config from './config';
import './SuperdenseCoding.css';

export default function SuperdenseCoding() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  
  // State from previous QKD page
  const [qkdKey, setQkdKey] = useState('');
  const [qkdSecure, setQkdSecure] = useState(false);
  
  // State for this page
  const [sdcEve, setSdcEve] = useState(false);
  const [satData, setSatData] = useState(null);

  useEffect(() => {
    if (location.state) {
      setQkdKey(location.state.qkdKey || '');
      setSdcEve(location.state.sdcEve || false);
      setQkdSecure(location.state.qkdSecure || false);
    } else {
        // Handle case where user navigates directly to this page
        setError("No QKD key provided. Please start from the QKD simulation page.");
        setQkdSecure(false);
    }
  }, [location.state]);

  const handleRunSDC = async () => {
    if (!qkdSecure || !qkdKey) {
        setError("Cannot run simulation with an insecure or missing QKD key.");
        return;
    }
    setIsLoading(true);
    setError(null);
    setResults(null);
    setSatData(null);
    
    try {
      const resp = await fetch(`${config.application.baseURL}/sdc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qkd_key: qkdKey,
          sdc_eve: sdcEve
        })
      });
      
      const data = await resp.json();

      if (resp.ok) {
        setResults(data.sdc);
        setSatData({
          latitude: data.sat_latitude,
          longitude: data.sat_longitude,
          binary: data.sat_message,
          real_time: data.sat_real_time,
          eclipsed: data.sat_eclipsed,
        });
      } else {
        setError(data.error || 'Failed to run superdense coding simulation');
      }
    } catch (e) {
      console.error(e);
      setError('Network error: Unable to connect to backend');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToQKD = () => navigate('/qkd-simulation');

  // --- NEW: Navigation handler for the Full Simulation page ---
  const handleGoToFullSimulation = () => {
    if (!qkdKey) {
      setError("No QKD key available to start full simulation.");
      return;
    }
  
    navigate('/full-simulation', {
      state: {
        qkdKey: qkdKey,          // pass the current QKD key
        message: satData?.binary || '00', // optional: pass the 2-bit message
        simulateEve: sdcEve      // optional: if Eve is simulated here
      }
    });
  };
  
  const histogramData = results?.histogram
    ? Object.entries(results.histogram)
      .map(([key, value]) => ({ name: String(key).split('').reverse().join(''), value }))
      .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const formatDensityMatrix = (matrix) => {
    if (!matrix) return null;
    return matrix.map((row) =>
      row.map((c) => {
        const r = (c.real || 0).toFixed(2);
        const i = (c.imaginary || 0).toFixed(2);
        return `${r}${i >= 0 ? '+' : ''}${i}i`;
      })
    );
  };
  
  return (
    <>
      <Particles
        particleCount={200}
        particleSpread={10}
        speed={0.2}
        particleColors={['#667eea', '#764ba2', '#f093fb', '#22d3ee']}
      />
      <div className="sdc-page">
        <motion.div
          className="sdc-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <header className="sdc-header">
            <motion.h1 className="sdc-title">Superdense Coding with Real-Time Satellite Data</motion.h1>
            <motion.p className="sdc-subtitle">
              Use the secure QKD key to encrypt and transmit a 2-bit message generated from a satellite's real-time position.
            </motion.p>
          </header>

          <div className="sdc-main-section">
            <h2 className="section-title">Security: QKD Key</h2>
            {qkdKey ? (
              <div className="qkd-key-display">
                {qkdKey.split('').map((b, i) => <span key={i} className="qkd-key-bit">{b}</span>)}
              </div>
            ) : <p className="info-text">No QKD key found.</p>}
            {!qkdSecure && <div className="error-message">⚠ QKD key is insecure! You can run the simulation, but the result is not cryptographically secure.</div>}
          </div>

          <div className="sdc-main-section">
            <h2 className="section-title">Protocol: Superdense Coding</h2>
             <div className="control-group">
               <label>Simulate Eavesdropper (Eve):</label>
               <HoloToggle checked={sdcEve} onChange={setSdcEve} labelOn="Active" labelOff="Inactive" />
             </div>
             <button className="run-sdc-button" onClick={handleRunSDC} disabled={isLoading || !qkdKey}>
                {isLoading ? 'Transmitting...' : 'Run SDC with Satellite Data'}
             </button>
             {sdcEve && <div className="eve-persistent-banner">⚠ Eve is active during transmission!</div>}
          </div>

          {error && <motion.div className="error-message" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>❌ {error}</motion.div>}

          {(results || satData) && (
            <motion.div className="sdc-main-section" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className="section-title">Analysis: Results</h2>
                
                {satData && (
                    <div className="satellite-data-card">
                        <h3>Real-Time Satellite Data (ISS)</h3>
                        <p><strong>Latitude:</strong> {satData.latitude.toFixed(4)}°</p>
                        <p><strong>Longitude:</strong> {satData.longitude.toFixed(4)}°</p>
                        <p><strong>Timestamp:</strong> {satData.real_time}</p>
                        <p><strong>In Earth's Shadow (Eclipsed):</strong> {satData.eclipsed ? 'Yes' : 'No'}</p>
                        <p><strong>Transmitted Message:</strong> <span className="message-bit">{satData.binary}</span></p>
                    </div>
                )}
                
                {results && (
                  <>
                    <div className={`${sdcEve ? 'warning-banner' : 'success-banner'}`}>
                      {sdcEve ? '⚠ Eve has interfered! Message may be corrupted.' : '✅ Entanglement successful. Message delivered securely.'}
                    </div>

                    <div className="status-section">
                      <div className="status-card">
                        <h4>Encrypted Message</h4>
                        <div className="message-display">
                          {results.encrypted_message?.map((b, i) => <span key={i} className="message-bit encrypted">{b}</span>)}
                        </div>
                      </div>
                      <div className={`status-card ${sdcEve ? 'warning-card' : 'success-card'}`}>
                        <h4>Communication Status</h4>
                        <p className={`status-text ${sdcEve ? 'warning' : 'success'}`}>{results.communication_status}</p>
                      </div>
                    </div>
                    
                    {results.circuit && (
                      <div className="circuit-section">
                        <h3>Quantum Circuit</h3>
                        <img src={`data:image/png;base64,${results.circuit}`} alt="Circuit" className="circuit-image" />
                      </div>
                    )}

                    {histogramData.length > 0 && (
                      <div className="histogram-section">
                        <h3>Measurement Histogram {sdcEve ? '(with Eve\'s Tampering)' : ''}</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={histogramData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="value" fill={sdcEve ? '#ef4444' : '#22c55e'} label={{ position: 'top' }} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    
                    {results.bloch_spheres?.length > 0 && (
                      <div className="bloch-section">
                          <h3>Bloch Spheres (State Before Transmission)</h3>
                          <div className="bloch-gallery">
                            {results.bloch_spheres.map((b64, i) => (
                               <div key={`sdc-bloch-${i}`} className="bloch-item">
                                   <img src={`data:image/png;base64,${b64}`} alt={`Qubit ${i}`} />
                                   <p className="bloch-label">Qubit {i}</p>
                               </div>
                            ))}
                          </div>
                      </div>
                    )}

                  </>
                )}
            </motion.div>
          )}

          {/* --- MODIFIED: Navigation buttons at the end of the page --- */}
          <div className="navigation-section">
            <button onClick={handleBackToQKD} className="back-button">← Back to QKD</button>
            
            {/* This button will only appear after results are loaded */}
            {results && (
              <button onClick={handleGoToFullSimulation} className="proceed-button">
                Start Full Simulation →
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </>
  );
}