// FullSimulation.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import config from './config';
import './FullSimulation.css';

export default function FullSimulation() {
  // OTP Encryption using QKD key (string of bits)
  const otpEncrypt = (message, key) => {
    if (!key || key.length === 0) return message;
    let encrypted = '';
    for (let i = 0; i < message.length; i++) {
      const messageChar = message.charCodeAt(i);
      const keyBit = parseInt(key[i % key.length]);
      const encryptedChar = messageChar ^ keyBit;
      encrypted += String.fromCharCode(encryptedChar);
    }
    return encrypted;
  };

  // OTP Decryption using QKD key (symmetric XOR)
  const otpDecrypt = (encryptedMessage, key) => {
    return otpEncrypt(encryptedMessage, key);
  };

  // Load QKD key from localStorage
  const loadQKDKey = () => {
    const storedKey = localStorage.getItem('qkdKey');
    const storedSecure = localStorage.getItem('qkdSecure');
    if (storedKey) {
      setQkdKey(storedKey);
      console.log('Loaded QKD key from storage:', storedKey);
      return storedKey;
    }
    return null;
  };

  const navigate = useNavigate();
  const location = useLocation();

  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const [qkdKey, setQkdKey] = useState('');
  // const [qber, setQber] = useState(null);
  const [chshValue, setChshValue] = useState(null);
const [bellViolated, setBellViolated] = useState(null);
  const [originalMessage, setOriginalMessage] = useState('');
  const [predictedValues, setPredictedValues] = useState([]);
  const [encryptedMessage, setEncryptedMessage] = useState('');
  const [decryptedMessage, setDecryptedMessage] = useState('');
  const [binaryMessage, setBinaryMessage] = useState('');
  const [sdcResults, setSdcResults] = useState(null);
  const [transmissionData, setTransmissionData] = useState(null);

  const [predictedLat, setPredictedLat] = useState(null);
  const [predictedLon, setPredictedLon] = useState(null);
  const [predictedRestricted, setPredictedRestricted] = useState(null);
  const [decryptedRestricted, setDecryptedRestricted] = useState(null);

  // ✅ ADDED: State for storing average fidelities
  const [avgFidelityIdeal, setAvgFidelityIdeal] = useState(null);
  const [avgFidelityNoisy, setAvgFidelityNoisy] = useState(null);
  const [avgFidelityShor, setAvgFidelityShor] = useState(null);

  useEffect(() => {
    // Load QKD key from localStorage instead of fetching
    const key = loadQKDKey();
    const storedS = localStorage.getItem('chshS');
const storedBell = localStorage.getItem('bellViolated');

if (storedS) {
  setChshValue(parseFloat(storedS));
}
if (storedBell) {
  setBellViolated(storedBell === 'true');
}

    if (!key) {
      setError('No QKD key found. Please generate a key first.');
    }
  }, []);

  useEffect(() => {
    // If navigated with state from AircraftNavigation, load predicted values
    if (location.state) {
      setQkdKey(location.state.qkdKey || '');
      // setQber(location.state.qber || null);
      if (Array.isArray(location.state.predicted)) {
        setPredictedValues(location.state.predicted || []);
        if (location.state.predicted.length > 0) {
          setPredictedLat(location.state.predicted[0].lat);
          setPredictedLon(location.state.predicted[0].lon);
          setPredictedRestricted(location.state.predicted[0].restricted);
        }
      } else if (location.state.predicted) {
        setPredictedValues([location.state.predicted]);
        setPredictedLat(location.state.predicted.lat);
        setPredictedLon(location.state.predicted.lon);
        setPredictedRestricted(location.state.predicted.restricted);
      }
    }
  }, [location.state]);

  // Convert float to binary (scaled)
  const floatToBinary = (value, bits = 32) => {
    // Map value to scaled integer to preserve decimals (-180..180 to int)
    const intVal = Math.round((value + 180) * 100000);
    let bin = intVal.toString(2);
    return bin.padStart(bits, '0');
  };

  // Convert binary to float
  const binaryToFloat = (bin, bits = 32) => {
    if (!bin) return null;
    const intVal = parseInt(bin, 2);
    return intVal / 100000 - 180;
  };

  // Proper binary decode into lat/lon and restricted status
  const binaryToLatLon = (binary) => {
    if (!binary || binary.length < 1) return { lat: null, lon: null, restricted: null };
    
    // Extract the restricted bit first (last bit of the binary)
    const restrictedBit = binary.length >= 65 ? binary[64] : '0';
    const restricted = restrictedBit === '1' ? 'Yes' : 'No';
    
    // If we don't have enough bits for lat/lon, just return the restricted status
    if (binary.length < 65) return { lat: null, lon: null, restricted };
    
    // Extract latitude and longitude
    const latBin = binary.slice(0, 32);
    const lonBin = binary.slice(32, 64);
    
    return {
      lat: binaryToFloat(latBin),
      lon: binaryToFloat(lonBin),
      restricted
    };
  };

  // One-time pad encrypt for 2-bit chunks (binary string)
  const oneTimePadEncrypt = (chunk, key, keyOffset = 0) => {
    if (!key || !chunk) return chunk;
    let encrypted = '';
    for (let i = 0; i < chunk.length; i++) {
      const keyBit = key[(keyOffset + i) % key.length];
      encrypted += (parseInt(chunk[i]) ^ parseInt(keyBit)).toString();
    }
    return encrypted;
  };

  // One-time pad decrypt for binary chunks (same as encrypt)
  const oneTimePadDecrypt = (encryptedChunk, key, keyOffset = 0) => {
    if (!key || !encryptedChunk) return encryptedChunk;
    let decrypted = '';
    for (let i = 0; i < encryptedChunk.length; i++) {
      const keyBit = key[(keyOffset + i) % key.length];
      decrypted += (parseInt(encryptedChunk[i]) ^ parseInt(keyBit)).toString();
    }
    return decrypted;
  };

  const processSuperdenseCoding = async (binaryData, qkdKey, p_error = 0.05, shots = 1024) => {
    if (!binaryData || !qkdKey) return null;

    const chunks = [];
    for (let i = 0; i < binaryData.length; i += 2) {
      const chunk = binaryData.slice(i, i + 2).padEnd(2, '0');
      chunks.push(chunk);
    }

    const encryptedChunks = chunks.map((ch, idx) => {
      const keyOffset = (idx * 2) % qkdKey.length;
      return oneTimePadEncrypt(ch, qkdKey, keyOffset);
    });

    const urlsToTry = [
      `${config.errorCorrection.baseURL}${config.errorCorrection.endpoints.compareCorrected}`,
      ...config.errorCorrection.fallbackURLs.map(url => `${url}${config.errorCorrection.endpoints.compareCorrected}`)
    ];

    let lastError = null;
    
    for (const url of urlsToTry) {
      try {
        console.log(`Trying to connect to: ${url}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000); 
        
        const response = await fetch(url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            bits: encryptedChunks,
            shots: shots,
            p_error: p_error
          }),
          signal: controller.signal,
          mode: 'cors',
          credentials: 'same-origin'
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message || 
            `Backend error (${url}): ${response.status} ${response.statusText}`
          );
        }
        
        console.log(`Successfully connected to: ${url}`);
        const data = await response.json();
        
        const correctedMessages = data.corrected_messages || [];

        const transmissionResults = encryptedChunks.map((encryptedChunk, idx) => {
          const originalChunk = chunks[idx] || '00';
          const keyOffset = (idx * 2) % qkdKey.length;
          const backendItem = correctedMessages[idx] || {};
          const receivedChunk = backendItem.corrected_message ?? encryptedChunk;
          const fidelity = backendItem.fidelity ?? 0;
          const status = fidelity >= 50 ? 'OK' : 'Failed';
          return {
            index: idx,
            originalChunk,
            encryptedChunk,
            receivedChunk,
            status,
            fidelity,
            keyOffset
          };
        });

        const successfulTransmissions = transmissionResults.filter(r => r.status === 'OK').length;

        return {
          originalChunks: chunks,
          encryptedChunks,
          transmissionResults,
          totalChunks: chunks.length,
          successfulTransmissions,
          fidelities_shor: data.fidelities_shor || [],
          fidelities_noisy: data.fidelities_noisy || [],
          fidelities_ideal: data.fidelities_ideal || [],
          fidelity_graph: data.fidelity_graph || null
        };

      } catch (err) {
        console.warn(`Failed to connect to ${url}:`, err.message);
        lastError = err;
        continue;
      }
    }
    
    throw new Error(
      `Failed to connect to any error correction service. ` +
      `Tried: ${urlsToTry.join(', ')}. ` +
      `Last error: ${lastError?.message || 'Unknown error'}`
    );
  };

  const reconstructBinaryData = (sdcResults, qkdKey) => {
    if (!sdcResults || !sdcResults.transmissionResults || !qkdKey) return '';

    // Reconstruct the binary data from the received chunks
    const decryptedBinary = sdcResults.transmissionResults.map((result, idx) => {
      if (result.status === 'OK') {
        const receivedEncryptedChunk = result.receivedChunk;
        const decryptedChunk = oneTimePadDecrypt(receivedEncryptedChunk, qkdKey, result.keyOffset);
        console.log(`Chunk ${idx + 1}:`, {
          original: result.originalChunk,
          received: receivedEncryptedChunk,
          decrypted: decryptedChunk,
          status: result.status,
          fidelity: result.fidelity
        });
        return decryptedChunk;
      } else {
        console.warn(`Chunk ${idx + 1} transmission failed, using original chunk`);
        return result.originalChunk || '00';
      }
    }).join('');

    console.log('Full reconstructed binary:', decryptedBinary);
    if (decryptedBinary.length >= 65) {
      const restrictedBit = decryptedBinary[64];
      console.log('Restricted bit (65th bit):', restrictedBit, '->', restrictedBit === '1' ? 'Yes' : 'No');
    }
    return decryptedBinary;
  };

  const [combinedBinary, setCombinedBinary] = useState('');
  const [encryptedCombinedBinary, setEncryptedCombinedBinary] = useState('');
  const [encryptedBinaryDisplay, setEncryptedBinaryDisplay] = useState('');

  const handleRunFullSimulation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const storedQkdKey = localStorage.getItem('qkdKey');
      if (!storedQkdKey) {
        throw new Error('No QKD key available. Please generate a key first from QKD Simulation.');
      }

      const latBin = predictedLat !== null ? floatToBinary(predictedLat) : ''.padStart(32, '0');
      const lonBin = predictedLon !== null ? floatToBinary(predictedLon) : ''.padStart(32, '0');
      const restrictedBin = predictedRestricted === "Yes" ? "1" : "0";
      const combinedBin = latBin + lonBin + restrictedBin;
      setCombinedBinary(combinedBin);

      const encryptedBinChars = otpEncrypt(combinedBin, storedQkdKey);
      setEncryptedMessage(encryptedBinChars);

      // const p_error = qber !== null ? qber : 0.05;
      let p_error = 0.05; // default

if (chshValue !== null) {
  if (Math.abs(chshValue) <= 2) {
    p_error = 0.25; // insecure / classical
  } else if (Math.abs(chshValue) < 2.4) {
    p_error = 0.12; // weak entanglement
  } else {
    p_error = 0.03; // strong entanglement
  }
}


      let sdcRes;
      try {
        sdcRes = await processSuperdenseCoding(combinedBin, storedQkdKey, p_error, 1024);
      } catch (sdcError) {
        console.error('Error in superdense coding:', sdcError);
        throw new Error(`Error during quantum transmission: ${sdcError.message}`);
      }
      
      if (!sdcRes) {
        throw new Error('SDC transmission failed: No response from server');
      }

      setSdcResults(sdcRes);

      // ✅ ADDED: Calculate and set average fidelities
      const calculateAverage = (arr) => {
        if (!arr || arr.length === 0) return 0;
        const sum = arr.reduce((a, b) => a + b, 0);
        return sum / arr.length;
      };

      setAvgFidelityIdeal(calculateAverage(sdcRes.fidelities_ideal));
      setAvgFidelityNoisy(calculateAverage(sdcRes.fidelities_noisy));
      setAvgFidelityShor(calculateAverage(sdcRes.fidelities_shor));


      const transmittedData = {
        originalBinary: combinedBin,
        qkdKey: storedQkdKey,
        // qber: qber,
        sdcResults: sdcRes,
        transmissionStatus: sdcRes ? 'Success' : 'Failed'
      };
      setTransmissionData(transmittedData);

      const reconstructedBinary = reconstructBinaryData(sdcRes, storedQkdKey);
      setDecryptedMessage(reconstructedBinary);

      const encryptedBinary = sdcRes.transmissionResults.map(r => r.receivedChunk).join('') || '';
      setEncryptedBinaryDisplay(encryptedBinary);
      setEncryptedCombinedBinary(JSON.stringify(sdcRes.transmissionResults.map(r => r.encryptedChunk) || []));
      
      // Store encryptedBinary in localStorage for persistence
      localStorage.setItem("encryptedBinary", encryptedBinary);
      

      
      // Get coordinates and restricted status from the reconstructed binary
      const coordinates = binaryToLatLon(reconstructedBinary);
      console.log('Decoded coordinates:', coordinates);
      setDecryptedRestricted(coordinates.restricted);
      
      // Update the results with the decoded coordinates and restricted status
      setResults(prevResults => ({
        ...prevResults,
        aircraft: {
          ...(prevResults?.aircraft || {}),
          decodedLatitude: coordinates.lat,
          decodedLongitude: coordinates.lon,
          restrictedArea: coordinates.restricted
        }
      }));

      setResults({
        qkd: {
  qkd_key: storedQkdKey,
  chsh_S: chshValue,
  bell_violated: bellViolated
},
        sdc: {
          communication_status: `${sdcRes.successfulTransmissions}/${sdcRes.totalChunks} qubits transmitted successfully`,
          encrypted_message: sdcRes.transmissionResults,
          transmission_method: 'Superdense Coding Protocol (Shor 9-qubit corrected)'
        }
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Network error: Unable to connect to backend');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToSuperdense = () => navigate('/navigation');

  return (
    <>
      <div className="full-simulation-page" style={{ position: 'relative', zIndex: 1, minHeight: '100vh', overflow: 'visible' }}>
        <motion.div
          className="full-simulation-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="full-simulation-content">
            <header className="full-simulation-header">
              <motion.h1
                className="full-simulation-title"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                End-to-End Simulation
              </motion.h1>
            </header>

            {/* Initial Ground Station Info */}
            {!results && (
              <motion.div className="ground-station-box" style={{border: '2px solid #22d3ee', borderRadius: '12px', padding: '18px', marginBottom: '24px', background: 'rgba(34,211,238,0.08)'}}>
                <h3 style={{color: '#22d3ee'}}>Ground Station</h3>
                <div className="parameters-grid">
                  <div className="parameter-item"><span className="parameter-label">Predicted Latitude:</span><span className="parameter-value">{predictedLat !== null ? predictedLat.toFixed(5) : 'N/A'}</span></div>
                  <div className="parameter-item"><span className="parameter-label">Predicted Longitude:</span><span className="parameter-value">{predictedLon !== null ? predictedLon.toFixed(5) : 'N/A'}</span></div>
                  <div className="parameter-item"><span className="parameter-label">Restricted Area:</span><span className="parameter-value">{predictedRestricted !== null ? predictedRestricted : 'N/A'}</span></div>
                  <div className="parameter-item"><span className="parameter-label">Original Binary:</span><span className="parameter-value" style={{fontSize:'0.85em',wordBreak:'break-all'}}>{combinedBinary || 'N/A'}</span></div>
                  <div className="parameter-item"><span className="parameter-label">QKD Encryption Key:</span><span className="parameter-value" style={{fontSize:'0.85em',wordBreak:'break-all',color:'#4ade80'}}>{qkdKey || localStorage.getItem('qkdKey') || 'No key available'}</span></div>
                  <div className="parameter-item"><span className="parameter-label">Encrypted Binary (OTP):</span><span className="parameter-value" style={{fontSize:'0.85em',wordBreak:'break-all',color:'#ff6b6b'}}>{encryptedBinaryDisplay || 'Preparing...'}</span></div>
                  {/* <div className="parameter-item"><span className="parameter-label">QBER:</span><span className="parameter-value">{qber !== null ? `${(qber * 100).toFixed(2)}%` : 'N/A'}</span></div>
                   */}
      

                  <div className="parameter-item"><span className="parameter-label">SDC Transmission Results:</span><span className="parameter-value" style={{fontSize:'0.85em',wordBreak:'break-all'}}>{sdcResults ? `${sdcResults.totalChunks} qubits prepared` : 'Preparing...'}</span></div>
                </div>
                <div style={{marginTop: '18px'}}>
                  <div><strong>Superdense Coding:</strong> <span style={{color:'#22d3ee'}}>{sdcResults ? `Ready to transmit ${sdcResults.totalChunks} quantum-encoded qubits` : 'Message prepared at Ground Station...'}</span></div>
                </div>
              </motion.div>
            )}

            {!results && (
              <motion.div className="run-section">
                <motion.button
                  className="run-full-simulation-button"
                  onClick={handleRunFullSimulation}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={isLoading}
                >
                  {isLoading ? 'Running Full Simulation...' : 'Run Full Simulation'}
                </motion.button>
              </motion.div>
            )}

            {error && <div className="error-message">❌ {error}</div>}

            {/* Ground Station Results */}
            {results && (
              <motion.div className="ground-station-box" style={{border: '2px solid #22d3ee', borderRadius: '12px', padding: '18px', marginBottom: '24px', background: 'rgba(34,211,238,0.08)'}}>
                <h3 style={{color: '#22d3ee', fontSize: '2rem', fontWeight: '700', letterSpacing: '1px'}}>GROUND STATION</h3>
                <div className="parameters-grid">
                  <div className="parameter-item"><span className="parameter-label">Predicted Latitude:</span><span className="parameter-value">{predictedLat?.toFixed(5) || 'N/A'}</span></div>
                  <div className="parameter-item"><span className="parameter-label">Predicted Longitude:</span><span className="parameter-value">{predictedLon?.toFixed(5) || 'N/A'}</span></div>
                  <div className="parameter-item"><span className="parameter-label">Restricted Area:</span><span className="parameter-value">{predictedRestricted || 'N/A'}</span></div>
                  <div className="parameter-item"><span className="parameter-label">Original Binary:</span><span className="parameter-value" style={{fontSize:'0.85em',wordBreak:'break-all'}}>{combinedBinary || 'N/A'}</span></div>
                  <div className="parameter-item"><span className="parameter-label">QKD Encryption Key:</span><span className="parameter-value" style={{fontSize:'0.85em',wordBreak:'break-all',color:'#4ade80'}}>{qkdKey || localStorage.getItem('qkdKey') || 'No key available'}</span></div>
                  <div className="parameter-item"><span className="parameter-label">Encrypted Binary (OTP):</span><span className="parameter-value" style={{fontSize:'0.85em',wordBreak:'break-all',color:'#ff6b6b'}}>{encryptedBinaryDisplay || 'N/A'}</span></div>
                  {/* <div className="parameter-item"><span className="parameter-label">QBER:</span><span className="parameter-value">{qber !== null ? `${(qber * 100).toFixed(2)}%` : 'N/A'}</span></div>
                   */}
                   {/* <div className="parameter-item"><span className="parameter-label">CHSH Value (S):</span><span className="parameter-value">{localStorage.getItem('S_value') || 'N/A'}</span></div>
                    */}
                    <span>
  {chshValue !== null ? chshValue.toFixed(3) : 'N/A'}
</span>
<span>
  {bellViolated ? 'VIOLATED (Quantum Secure)' : 'NOT Violated (Insecure)'}
</span>

                  <div className="parameter-item"><span className="parameter-label">Bell Inequality:</span><span className="parameter-value">{localStorage.getItem('bellViolated') === 'true' ? 'VIOLATED (Quantum Secure)' : 'NOT Violated (Insecure)'}</span></div>
                  <div className="parameter-item"><span className="parameter-label">SDC Transmission Method:</span><span className="parameter-value">{results.sdc?.transmission_method || 'Superdense Coding Protocol'}</span></div>
                  {sdcResults && (
                    <div className="parameter-item chunks-wide">
                      <span className="parameter-label">Quantum Qubits Transmitted:</span>
                      <div className="quantum-chunks-grid">
                        {sdcResults.transmissionResults.map((result, idx) => (
                          <div key={idx} className="quantum-chunk-item">
                            <div className="chunk-header">Qubit {idx + 1}</div>
                            <div className="chunk-data">{result.encryptedChunk}</div>
                            <div className={`chunk-status ${result.status === 'OK' ? 'success' : 'failed'}`}>
                              {result.status} ({result.fidelity.toFixed(1)}%)
                            </div>
                            <div className="chunk-received">Received: {result.receivedChunk}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{marginTop: '18px'}}>
                  <div><strong>Superdense Coding:</strong> <span style={{color:'#22d3ee'}}>{results.sdc?.communication_status || 'N/A'}</span></div>
                </div>
              </motion.div>
            )}

            {/* Aircraft Box */}
            {results && (
              <motion.div className="aircraft-box" style={{border: '2px solid #764ba2', borderRadius: '12px', padding: '18px', marginTop: '24px', background: 'rgba(118,75,162,0.08)'}}>
                <h3 style={{color: 'violet', fontSize: '2rem', fontWeight: '700', letterSpacing: '1px'}}>AIRCRAFT</h3>
                <div className="parameters-grid">
                  <div className="parameter-item"><span className="parameter-label">Received Encrypted Binary:</span><span className="parameter-value" style={{fontSize:'0.85em',wordBreak:'break-all',color:'#ff6b6b'}}>{encryptedBinaryDisplay || 'N/A'}</span></div>
                  <div className="parameter-item"><span className="parameter-label">Decrypted Binary (OTP):</span><span className="parameter-value" style={{fontSize:'0.85em',wordBreak:'break-all',color:'#4ade80'}}>{decryptedMessage || 'N/A'}</span></div>
                  <div className="parameter-item"><span className="parameter-label">Decoded Latitude:</span><span className="parameter-value">{binaryToLatLon(decryptedMessage).lat !== null ? binaryToLatLon(decryptedMessage).lat.toFixed(5) : 'N/A'}</span></div>
                  <div className="parameter-item"><span className="parameter-label">Decoded Longitude:</span><span className="parameter-value">{binaryToLatLon(decryptedMessage).lon !== null ? binaryToLatLon(decryptedMessage).lon.toFixed(5) : 'N/A'}</span></div>
                  <div className="parameter-item"><span className="parameter-label">Restricted Area:</span><span className="parameter-value">{decryptedRestricted || 'N/A'}</span></div>
                </div>
                <div style={{marginTop: '18px'}}>
                  <div><strong>Quantum Message Decoded at Aircraft!</strong></div>
                  {sdcResults && (
                    <div style={{marginTop: '12px', fontSize: '0.9em'}}>
                      <div><strong>Transmission Summary:</strong></div>
                      <div>• Total quantum qubits: {sdcResults.totalChunks}</div>
                      <div>• Successful transmissions: {sdcResults.successfulTransmissions}</div>
                      <div>• Success rate: {((sdcResults.successfulTransmissions / sdcResults.totalChunks) * 100).toFixed(1)}%</div>
                      <div>• Protocol: {results.sdc?.transmission_method}</div>
                      
                      {/* ✅ ADDED: Display for average fidelities */}
                      <div style={{marginTop: '10px'}}><strong>🎯 Average Fidelity Comparison:</strong></div>
                      <div style={{color: '#4ade80'}}>• Ideal Channel: {avgFidelityIdeal?.toFixed(2)}%</div>
                      <div style={{color: '#ff6b6b'}}>• Noisy Channel (Uncorrected): {avgFidelityNoisy?.toFixed(2)}%</div>
                      <div style={{color: '#22d3ee'}}>• Shor QEC Channel (Corrected): {avgFidelityShor?.toFixed(2)}%</div>

                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Comparison Button - Only show when results are available */}
            {results && (
              <motion.div className="comparison-section" style={{textAlign: 'center', marginTop: '24px', display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap'}}>
                
                <motion.button
                  className="error-analysis-button"
                  onClick={() => navigate('/comparisionnew')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    background: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    marginBottom: '16px',
                    boxShadow: '0 4px 15px rgba(253, 160, 133, 0.3)',
                    transition: 'all 0.3s ease',
                    minWidth: '240px'
                  }}
                >
                  🔍 View Error Analysis
                </motion.button>
              </motion.div>
            )}

            <div className="navigation-section">
              <button onClick={handleBackToSuperdense} className="back-button">
                ← Back to Home
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}