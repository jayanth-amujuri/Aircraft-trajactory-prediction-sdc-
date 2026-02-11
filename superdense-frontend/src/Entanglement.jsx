import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Particles from './Particles';
import { motion } from 'framer-motion';
import { useSimulation } from './SimulationContext';
import './App.css';

export default function Entanglement() {
  const navigate = useNavigate();
  const { eveEnabled } = useSimulation();
  const [animating, setAnimating] = useState(false);

  const handleCreateEntanglement = () => {
    setAnimating(true);
    setTimeout(() => navigate('/encoding'), 1200);
  };

  return (
    <div className="page-container">
      <Particles particleCount={400} particleSpread={20} speed={0.2} particleColors={["#667eea", "#764ba2", "#f093fb", "#22d3ee", "#2563eb", "#7c3aed"]} moveParticlesOnHover={true} particleHoverFactor={3} alphaParticles={true} particleBaseSize={100} sizeRandomness={1.0} cameraDistance={30} disableRotation={false} />

      <div className="flow-layout">
        <div className="side earth">🌍</div>
        <div className="center">
          <h1 className="title">Efficient Quantum Communication using Superdense Coding</h1>
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleCreateEntanglement} className="primary-btn">Create Entanglement</motion.button>
          <div className="progress">Entanglement → Encoding → Transmission → Results</div>
        </div>
        <div className="side satellite">🛰️</div>
      </div>

      <motion.div className={`entangle-beam ${animating ? 'active' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: animating ? 1 : 0 }} transition={{ duration: 0.6 }} />
    </div>
  );
}


