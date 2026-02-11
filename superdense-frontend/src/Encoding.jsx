import { useNavigate } from 'react-router-dom';
import Particles from './Particles';
import { motion } from 'framer-motion';
import { useSimulation } from './SimulationContext';
import './App.css';

const OPTIONS = ['00', '01', '10', '11'];

export default function Encoding() {
  const navigate = useNavigate();
  const { message, setMessage, eveEnabled, setEveEnabled } = useSimulation();

  const handleSelect = (m) => {
    setMessage(m);
    navigate('/transmission');
  };

  return (
    <div className="page-container">
      <Particles particleCount={400} particleSpread={20} speed={0.2} particleColors={["#667eea", "#764ba2", "#f093fb", "#22d3ee", "#2563eb", "#7c3aed"]} moveParticlesOnHover={true} particleHoverFactor={3} alphaParticles={true} particleBaseSize={100} sizeRandomness={1.0} cameraDistance={30} disableRotation={false} />

      <div className="flow-layout">
        <div className="side earth">🌍</div>
        <div className="center">
          <h2 className="title">Choose bits to encode</h2>
          <div className="encode-options">
            {OPTIONS.map(opt => (
              <motion.button key={opt} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} onClick={() => handleSelect(opt)} className={`option ${message === opt ? 'active' : ''}`}>{opt}</motion.button>
            ))}
          </div>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => setEveEnabled(!eveEnabled)} className={`secondary-btn ${eveEnabled ? 'active' : ''}`}>{eveEnabled ? 'Disable Eve' : 'Enable Eve'}</motion.button>
          <div className="progress">Entanglement → Encoding → Transmission → Results</div>
        </div>
        <div className="side satellite">🛰️</div>
      </div>
    </div>
  );
}


