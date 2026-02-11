import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Particles from './Particles';
import { motion } from 'framer-motion';
import { useSimulation } from './SimulationContext';
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './App.css';

export default function Results() {
  const navigate = useNavigate();
  const { message, eveEnabled } = useSimulation();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const blochMountRef = useRef(null);
  const threeCtxRef = useRef(null);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await fetch('http://127.0.0.1:5001/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, eve: eveEnabled })
        });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json.error || 'Simulation error');
        setData(json);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [message, eveEnabled]);

  // Render interactive bar chart
  useEffect(() => {
    if (!data || !data.probabilities) return;
    Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);
    const ctx = chartRef.current.getContext('2d');
    chartInstance.current?.destroy();
    chartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['00','01','10','11'],
        datasets: [{
          label: 'Probability',
          data: ['00','01','10','11'].map(k => data.probabilities[k] ?? 0),
          backgroundColor: '#60a5fa'
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, max: 1 }
        }
      }
    });
  }, [data]);

  // Render interactive Bloch sphere with Three.js using returned Bloch vector
  useEffect(() => {
    if (!data || !data.bloch_vector) return;

    // teardown previous scene
    if (threeCtxRef.current) {
      const { renderer, scene, camera, controls, frame } = threeCtxRef.current;
      cancelAnimationFrame(frame);
      renderer.dispose();
      controls.dispose();
      while (blochMountRef.current.firstChild) blochMountRef.current.removeChild(blochMountRef.current.firstChild);
      threeCtxRef.current = null;
    }

    const width = 320; const height = 320;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    const mount = blochMountRef.current;
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width/height, 0.1, 100);
    camera.position.set(0,0,4);
    const controls = new OrbitControls(camera, renderer.domElement);

    // sphere wireframe
    const geo = new THREE.SphereGeometry(1, 32, 32);
    const mat = new THREE.MeshBasicMaterial({ color: 0x2e6ee6, wireframe: true, opacity: 0.9, transparent: true });
    const sphere = new THREE.Mesh(geo, mat);
    scene.add(sphere);

    // axes
    const axes = new THREE.AxesHelper(1.3);
    scene.add(axes);

    // Bloch vector arrow
    const [bx, by, bz] = data.bloch_vector;
    const dir = new THREE.Vector3(bx, by, bz);
    const len = Math.min(Math.sqrt(bx*bx+by*by+bz*bz), 1.0);
    const arrow = new THREE.ArrowHelper(dir.clone().normalize(), new THREE.Vector3(0,0,0), len, 0x22c55e, 0.08, 0.04);
    scene.add(arrow);

    const light = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(light);

    let frame;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    threeCtxRef.current = { renderer, scene, camera, controls, frame };
    return () => {
      cancelAnimationFrame(frame);
      controls.dispose();
      renderer.dispose();
      while (mount.firstChild) mount.removeChild(mount.firstChild);
      threeCtxRef.current = null;
    };
  }, [data]);

  return (
    <div className="page-container">
      <Particles particleCount={400} particleSpread={20} speed={0.2} particleColors={["#667eea", "#764ba2", "#f093fb", "#22d3ee", "#2563eb", "#7c3aed"]} moveParticlesOnHover={true} particleHoverFactor={3} alphaParticles={true} particleBaseSize={100} sizeRandomness={1.0} cameraDistance={30} disableRotation={false} />
      <div className="results-layout">
        <div className="header">
          <h2 className="title">Results</h2>
          <div className="meta">Message: <strong>{message}</strong> · Eve: <strong>{eveEnabled ? 'On' : 'Off'}</strong></div>
        </div>

        {loading && <div className="loading">Running simulation…</div>}
        {error && <div className="error">{error}</div>}

        {data && !loading && !error && (
          <div className="panels">
            <div className="panel">
              <div className="panel-title">Probability Chart</div>
              <canvas ref={chartRef} width="320" height="240" />
            </div>

            <div className="panel">
              <div className="panel-title">Bloch Sphere (Interactive)</div>
              <div ref={blochMountRef} style={{ width: 320, height: 320 }} />
            </div>
          </div>
        )}

        <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/entanglement')} className="primary-btn mt">Restart Simulation</motion.button>
      </div>
    </div>
  );
}


