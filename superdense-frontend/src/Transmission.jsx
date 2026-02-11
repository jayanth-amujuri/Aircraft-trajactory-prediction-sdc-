import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Particles from './Particles';
import { motion } from 'framer-motion';
import { useSimulation } from './SimulationContext';
import './App.css';

export default function Transmission() {
  const navigate = useNavigate();
  const { eveEnabled } = useSimulation();
  const [phaseDone, setPhaseDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setPhaseDone(true);
      setTimeout(() => navigate('/results'), 900);
    }, 1200);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="page-container">
      <Particles particleCount={400} particleSpread={20} speed={0.2} particleColors={["#667eea", "#764ba2", "#f093fb", "#22d3ee", "#2563eb", "#7c3aed"]} moveParticlesOnHover={true} particleHoverFactor={3} alphaParticles={true} particleBaseSize={100} sizeRandomness={1.0} cameraDistance={30} disableRotation={false} />
      <div className="flow-layout">
        <div className="side earth">🌍</div>
        <div className="center">
          <h2 className="title">Transmitting qubit</h2>
          <div className={`transmission ${eveEnabled ? 'with-eve' : ''}`}>
            <motion.div className="particle" initial={{ x: -120 }} animate={{ x: eveEnabled ? 0 : 120 }} transition={{ duration: 1.0 }} />
            {eveEnabled && <div className="eve">🕵️‍♀️</div>}
            <motion.div className="particle" initial={{ x: eveEnabled ? 0 : 120 }} animate={{ x: 240 }} transition={{ duration: 1.0 }} />
          </div>
          <div className="status-msg">{eveEnabled ? '⚠️ Eve intercepted! Communication compromised' : '✅ Communication done successfully'}</div>
        </div>
        <div className="side satellite">🛰️</div>
      </div>
    </div>
  );
}


