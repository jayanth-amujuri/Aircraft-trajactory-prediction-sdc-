import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Particles from './Particles';
import config from './config';
import './Simulator.css';

const MESSAGES = ['00', '01', '10', '11'];

export default function Simulator() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('11');
  const [isLoadingLocal, setIsLoadingLocal] = useState(false);
  const [isLoadingIbm, setIsLoadingIbm] = useState(false);
  const [localResult, setLocalResult] = useState(null);
  const [ibmResult, setIbmResult] = useState(null);
  const [error, setError] = useState({ local: null, ibm: null });

  const handleBackToNavigation = () => {
    navigate('/navigation');
  };

  const handleRunSimulations = async () => {
    console.log('Starting simulations with message:', message);
    setIsLoadingLocal(true);
    setIsLoadingIbm(true);
    setError({ local: null, ibm: null });
    setLocalResult(null);
    setIbmResult(null);

    // Local simulation
    try {
      console.log('Fetching local simulation...');
      const localResponse = await fetch(`${config.testing.baseURL}${config.testing.endpoints.runSimulation}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          target: 'local'
        }),
      });
      console.log('Local response status:', localResponse.status);
      
      if (localResponse.ok) {
        const localData = await localResponse.json();
        console.log('Local simulation result:', localData);
        setLocalResult(localData);
      } else {
        const errorData = await localResponse.json();
        console.error('Local simulation error response:', errorData);
        setError(prev => ({ ...prev, local: errorData.error || 'Local simulation failed' }));
      }
    } catch (e) {
      console.error('Local simulation error:', e);
      setError(prev => ({ ...prev, local: 'Network error during local simulation' }));
    } finally {
      setIsLoadingLocal(false);
    }

    // IBM simulation
    try {
      console.log('Fetching IBM simulation...');
      const ibmResponse = await fetch(`${config.testing.baseURL}${config.testing.endpoints.runSimulation}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          target: 'ibm'
        }),
      });
      console.log('IBM response status:', ibmResponse.status);
      
      if (ibmResponse.ok) {
        const ibmData = await ibmResponse.json();
        console.log('IBM simulation result:', ibmData);
        setIbmResult(ibmData);
      } else {
        const errorData = await ibmResponse.json();
        console.error('IBM simulation error response:', errorData);
        setError(prev => ({ ...prev, ibm: errorData.error || 'IBM simulation failed' }));
      }
    } catch (e) {
      console.error('IBM simulation error:', e);
      setError(prev => ({ ...prev, ibm: 'Network error during IBM simulation' }));
    } finally {
      setIsLoadingIbm(false);
    }
  };

  const ResultCard = ({ title, isLoading, result, error: cardError }) => (
    <div className="result-card">
      <h3>{title}</h3>
      
      {isLoading && (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Running simulation...</p>
        </div>
      )}
      
      {cardError && (
        <div className="error-state">
          <p>❌ {cardError}</p>
        </div>
      )}
      
      {result && !isLoading && (
        <>
          {/* Success Rate Display */}
          {result.success_rate && (
            <div className="success-rate">
              Success Rate: {(result.success_rate * 100).toFixed(2)}%
            </div>
          )}
          
          {/* Backend Info Display */}
          {result.backend_name && (
            <div className="backend-info">
              <strong>Backend:</strong> {result.backend_name}
            </div>
          )}
          
          {result.job_id && (
            <div className="backend-info">
              <strong>Job ID:</strong> {result.job_id}
            </div>
          )}
          
          {/* Circuit Diagram */}
          <div className="circuit-container">
            <div className="circuit-title">Circuit Diagram</div>
            <div className="circuit-diagram">
              {result.circuit_image_b64 ? (
                <img 
                  src={`data:image/png;base64,${result.circuit_image_b64}`} 
                  alt="Quantum Circuit" 
                  style={{ maxWidth: '100%', height: 'auto' }}
                />
              ) : (
                <p>Circuit diagram will appear here</p>
              )}
            </div>
          </div>
          
          {/* Results */}
          <div className="results-container">
            <div className="results-title">Results</div>
            <div className="results-content">
              {result.histogram_image_b64 ? (
                <img 
                  src={`data:image/png;base64,${result.histogram_image_b64}`} 
                  alt="Results Histogram" 
                  style={{ maxWidth: '100%', height: 'auto' }}
                />
              ) : (
                <p>Results histogram will appear here</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      {/* Particles Background */}
      <Particles 
        particleCount={500}
        particleSpread={25}
        speed={0.25}
        particleColors={["#667eea", "#764ba2", "#f093fb", "#22d3ee", "#2563eb", "#7c3aed", "#06b6d4"]}
        moveParticlesOnHover={true}
        particleHoverFactor={4}
        alphaParticles={true}
        particleBaseSize={120}
        sizeRandomness={1.2}
        cameraDistance={35}
        disableRotation={false}
      />
      
      <div className="min-h-screen bg-slate-900 text-white font-sans p-4 sm:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header with Back Button */}
          <header className="text-center mb-8 relative simulator-header">
            <button
              onClick={handleBackToNavigation}
              className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
            >
              ← Back
            </button>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 simulator-title">
              Superdense Coding Simulator
            </h1>
            <p className="text-slate-400 mt-2">Compare a local Qiskit Aer simulation with a real IBM Quantum backend.</p>
          </header>

          <main>
            <div className="bg-slate-800/50 rounded-lg shadow-lg p-6 mb-8 flex flex-col sm:flex-row items-center justify-between gap-6 message-selector">
              <div className="flex items-center gap-4">
                <span className="font-bold text-lg text-cyan-300">Message to send:</span>
                <div className="flex space-x-2 bg-slate-700 p-1 rounded-lg">
                  {MESSAGES.map(msg => (
                    <button
                      key={msg}
                      onClick={() => setMessage(msg)}
                      className={`px-4 py-2 rounded-md font-mono font-bold transition-colors duration-200 message-button ${
                        message === msg ? 'active' : ''
                      }`}
                    >
                      {msg}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleRunSimulations}
                disabled={isLoadingLocal || isLoadingIbm}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-slate-500 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105 run-button"
              >
                {isLoadingLocal || isLoadingIbm ? 'Running Simulations...' : '🚀 Run & Compare'}
              </button>
            </div>

            {(isLoadingLocal || isLoadingIbm || localResult || ibmResult) && (
              <div className="flex flex-col lg:flex-row gap-8">
                <div className="w-full lg:w-1/2">
                  <ResultCard title="Local AerSimulator" isLoading={isLoadingLocal} result={localResult} error={error.local} />
                </div>
                <div className="w-full lg:w-1/2">
                  <ResultCard title="IBM Quantum Platform" isLoading={isLoadingIbm} result={ibmResult} error={error.ibm} />
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}