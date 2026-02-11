import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import aircraftImg from './assets/aircraft.png';
import groundImg from './assets/ground.png';

// Load GSAP dynamically from CDN
const GsapLoader = ({ onReady }) => {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js";
    script.async = true;
    script.onload = () => {
      console.log("GSAP loaded successfully");
      onReady();
    };
    script.onerror = () => console.error("Failed to load GSAP.");
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [onReady]);

  return null;
};

export default function HomePage() {
  const navigate = useNavigate();
  const [gsapReady, setGsapReady] = useState(false);
  const [isEntangled, setIsEntangled] = useState(false);
  const [message, setMessage] = useState(null);

  const satelliteRef = useRef(null);
  const planeRef = useRef(null);
  const groundRef = useRef(null);
  const laserBeam1Ref = useRef(null);
  const laserBeam2Ref = useRef(null);
  const laserBeam3Ref = useRef(null);
  const simulationAreaRef = useRef(null);

  // ⭐ STARFIELD + SPARKLES
  useEffect(() => {
    const canvas = document.getElementById("stars-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const stars = Array.from({ length: 150 }).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 1.5,
      alpha: Math.random(),
      speed: Math.random() * 0.02 + 0.01
    }));

    const sparkles = [];

    function createSparkle() {
      sparkles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * 0.5,
        radius: Math.random() * 2 + 1,
        dx: Math.random() * 3 + 2,
        dy: Math.random() * 1.5 + 1,
        color: `hsl(${Math.random() * 360}, 80%, 60%)`,
        life: 0
      });
    }

    const sparkleInterval = setInterval(createSparkle, 1500);

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw stars
      stars.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${star.alpha})`;
        ctx.fill();
        star.alpha += star.speed * (Math.random() < 0.5 ? -1 : 1);
        if (star.alpha <= 0) star.alpha = 0.1;
        if (star.alpha > 1) star.alpha = 1;
      });

      // Draw sparkles
      for (let i = sparkles.length - 1; i >= 0; i--) {
        const s = sparkles[i];
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.fill();

        s.x += s.dx;
        s.y += s.dy;
        s.life++;

        if (s.x > canvas.width || s.y > canvas.height || s.life > 60) {
          sparkles.splice(i, 1);
        }
      }

      requestAnimationFrame(animate);
    }

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearInterval(sparkleInterval);
    };
  }, []);

  const handleCreateEntanglement = () => {
    if (!gsapReady || typeof window.gsap === 'undefined') {
      console.error("GSAP is not ready yet.");
      return;
    }
    setIsEntangled(false);
    setMessage(null);
    if (!satelliteRef.current || !planeRef.current || !groundRef.current || !simulationAreaRef.current) {
      console.error("One or more refs are not set.");
      return;
    }
    const { gsap } = window;
    const simulationArea = simulationAreaRef.current;
    const satellite = satelliteRef.current;
    const plane = planeRef.current;
    const ground = groundRef.current;
    const laserBeam1 = laserBeam1Ref.current;
    const laserBeam2 = laserBeam2Ref.current;
    const laserBeam3 = laserBeam3Ref.current;
    const simAreaRect = simulationArea.getBoundingClientRect();
    const satelliteRect = satellite.getBoundingClientRect();
    const planeRect = plane.getBoundingClientRect();
    const groundRect = ground.getBoundingClientRect();
    const satelliteX = satelliteRect.left - simAreaRect.left + satelliteRect.width / 2;
    const satelliteY = satelliteRect.top - simAreaRect.top + satelliteRect.height / 2;
    const planeX = planeRect.left - simAreaRect.left + planeRect.width / 2;
    const planeY = planeRect.top - simAreaRect.top + planeRect.height / 2;
    const groundX = groundRect.left - simAreaRect.left + groundRect.width / 2;
    const groundY = groundRect.top - simAreaRect.top + groundRect.height / 2;
    const tl = gsap.timeline({});
    tl.set([laserBeam1, laserBeam2, laserBeam3], { opacity: 0 });
    // Laser: Satellite → Plane
    tl.set(laserBeam1, {
      attr: { x1: satelliteX, y1: satelliteY, x2: satelliteX, y2: satelliteY },
      opacity: 0,
    });
    tl.to(laserBeam1, {
      attr: { x2: planeX, y2: planeY },
      duration: 3.5,
      ease: 'power2.out',
      opacity: 1,
      filter: 'drop-shadow(0 0 10px #16a4ff)',
    });
    // Laser: Satellite → Ground
    tl.set(laserBeam2, {
      attr: { x1: satelliteX, y1: satelliteY, x2: satelliteX, y2: satelliteY },
      opacity: 0,
    }, "<");
    tl.to(laserBeam2, {
      attr: { x2: groundX, y2: groundY },
      duration: 3.5,
      ease: 'power2.out',
      opacity: 1,
      filter: 'drop-shadow(0 0 10px #16a4ff)',
    }, "<");
    // Show transfer message after both beams
    tl.add(() => {
      setMessage("Photons is transferred from the satellite to the aircraft and groundstation");
    }, "+=0.5");
    // Fade out initial beams after 4.5s
    tl.to([laserBeam1, laserBeam2], {
      opacity: 0,
      duration: 0.7,
    }, "+=4.5");
    // Final Correlated Beam: Plane → Ground
    tl.set(laserBeam3, {
      attr: { x1: planeX, y1: planeY, x2: planeX, y2: planeY },
      opacity: 0,
    });
    tl.to(laserBeam3, {
      attr: { x2: groundX, y2: groundY },
      duration: 4,
      ease: 'power4.out',
      opacity: 1,
      filter: 'drop-shadow(0 0 10px #16a4ff)',
      onStart: () => {
        gsap.fromTo(laserBeam3,
          { 'stroke-dasharray': 2000, 'stroke-dashoffset': 2000 },
          { 'stroke-dashoffset': 0, duration: 4, ease: 'linear' }
        );
      }
    }, "+=0.5");
    // Show entanglement success message after final beam
    tl.add(() => {
      setMessage("Entanglement successfully established");
      setIsEntangled(true);
    }, "+=0.5");
    // Clean up
    tl.to(laserBeam3, { opacity: 0, duration: 0.7 }, "+=0.7");
  };

  const handleNext = () => {
    navigate('/qkd-simulation');
  };

  return (
    <>
      <GsapLoader onReady={() => setGsapReady(true)} />
      <style>{`
        .home-page {
          display: flex;
          height: 100vh;
          width: 100vw;
          background: #000011;
          overflow: hidden;
          position: relative;
          flex-direction: row;
        }

        .sidebar {
          width: clamp(300px, 25%, 380px);
          background: rgba(10, 25, 47, 0.7);
          backdrop-filter: blur(12px);
          border-right: 1px solid rgba(107, 114, 128, 0.3);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1.5rem 1rem;
          gap: 1.5rem;
          z-index: 10;
          flex-shrink: 0;
        }

        .sidebar-title {
          font-size: clamp(1.2rem, 2vw, 1.6rem);
          color: #e5e7eb;
          font-weight: 600;
          margin-bottom: 1rem;
          border-bottom: 1px solid rgba(107, 114, 128, 0.5);
          padding-bottom: 0.5rem;
          width: 100%;
          text-align: center;
        }

        .nav-button {
          background: linear-gradient(145deg, #3b82f6, #8b5cf6);
          color: white;
          border: none;
          padding: 0.9rem 1.3rem;
          font-size: clamp(0.9rem, 1vw, 1rem);
          font-weight: 600;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s;
          width: 90%;
        }

        .nav-button:disabled {
          background: #4b5563;
          cursor: not-allowed;
          opacity: 0.7;
        }

        .simulation-area {
          flex-grow: 1;
          position: relative;
          height: 100%;
          width: 100%;
        }

        .emoji {
          position: absolute;
          user-select: none;
          will-change: transform;
          filter: drop-shadow(0 0 15px rgba(0, 191, 255, 0.4));
          max-width: 20vw;
        }

        .satellite {
          top: 10%;
          right: 30%;
          width: clamp(320px, 18vw, 280px);
          animation: float 6s ease-in-out infinite;
        }

        .plane {
          top: 60%;
          left: 15%;
          width: clamp(360px, 20vw, 320px);
          animation: float 8s ease-in-out infinite reverse;
        }

        .ground {
          bottom: 5%;
          right: 10%;
          width: clamp(380px, 22vw, 340px);
        }

        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
          100% { transform: translateY(0px); }
        }

        .laser-svg {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        .laser-beam {
          stroke: white;
          stroke-width: 12px;
          stroke-linecap: round;
          filter: drop-shadow(0 0 20px #16a4ff) drop-shadow(0 0 40px #16a4ff) drop-shadow(0 0 60px #16a4ff);
          opacity: 1;
          animation: laser-pulse 2s ease-in-out infinite alternate;
        }

        @keyframes laser-pulse {
          0% {
            filter: drop-shadow(0 0 15px #16a4ff) drop-shadow(0 0 30px #16a4ff) drop-shadow(0 0 45px #16a4ff);
          }
          100% {
            filter: drop-shadow(0 0 30px #16a4ff) drop-shadow(0 0 60px #16a4ff) drop-shadow(0 0 90px #16a4ff);
          }
        }

        .info-message {
          position: absolute;
          top: 15px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.7);
          color: #10b981;
          font-size: clamp(1rem, 2vw, 1.4rem);
          font-weight: bold;
          padding: 0.8rem 1.6rem;
          border-radius: 12px;
          box-shadow: 0 0 20px rgba(0, 185, 129, 0.6);
          z-index: 20;
          animation: fadeIn 0.5s ease-out;
          text-align: center;
        }

        .stars-canvas {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
          background: transparent;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }

        @media (max-width: 768px) {
          .home-page {
            flex-direction: column;
          }
          .sidebar {
            width: 100%;
            flex-direction: row;
            justify-content: space-around;
            border-right: none;
            border-bottom: 1px solid rgba(107,114,128,0.3);
          }
        }
      `}</style>

      <div className="home-page">
        <aside className="sidebar">
          <h2 className="sidebar-title">Controls</h2>
          <motion.button
            className="nav-button"
            onClick={handleCreateEntanglement}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={!gsapReady || message}
          >
            Create Entanglement
          </motion.button>
          <motion.button
            className="nav-button"
            onClick={handleNext}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={!isEntangled}
          >
            Communication
          </motion.button>
        </aside>

        <div ref={simulationAreaRef} className="simulation-area">
          {/* Stars Canvas */}
          <canvas id="stars-canvas" className="stars-canvas"></canvas>

          <img
            ref={satelliteRef}
            className="emoji satellite"
            src="https://res.cloudinary.com/dkpjimiip/image/upload/v1757147259/pngegg_esf5tj.png"
            alt="Satellite"
          />
          <img
            ref={planeRef}
            className="emoji plane"
            src={aircraftImg}
            alt="Aircraft"
          />
          <img
            ref={groundRef}
            className="emoji ground"
            src={groundImg}
            alt="Ground Station"
          />

          <svg className="laser-svg">
            <defs>
              <filter id="beam-glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="15" result="blur1" />
                <feGaussianBlur stdDeviation="8" result="blur2" />
                <feGaussianBlur stdDeviation="4" result="blur3" />
                <feMerge>
                  <feMergeNode in="blur1" />
                  <feMergeNode in="blur2" />
                  <feMergeNode in="blur3" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="beam-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00d4ff" />
                <stop offset="30%" stopColor="#16a4ff" />
                <stop offset="70%" stopColor="#0080ff" />
                <stop offset="100%" stopColor="#00d4ff" />
              </linearGradient>
              <linearGradient id="beam-gradient-special" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ff4080">
                  <animate attributeName="stop-color" values="#ff4080;#16a4ff;#00d4ff;#ff4080" dur="2.5s" repeatCount="indefinite" />
                </stop>
                <stop offset="50%" stopColor="#16a4ff" />
                <stop offset="100%" stopColor="#00d4ff">
                  <animate attributeName="stop-color" values="#00d4ff;#ff4080;#16a4ff;#00d4ff" dur="2.5s" repeatCount="indefinite" />
                </stop>
              </linearGradient>
            </defs>
            <line ref={laserBeam1Ref} stroke="url(#beam-gradient)" strokeWidth="12" strokeLinecap="round" filter="url(#beam-glow)" opacity="0" />
            <line ref={laserBeam2Ref} stroke="url(#beam-gradient)" strokeWidth="12" strokeLinecap="round" filter="url(#beam-glow)" opacity="0" />
            <line ref={laserBeam3Ref} stroke="url(#beam-gradient-special)" strokeWidth="14" strokeLinecap="round" filter="url(#beam-glow)" opacity="0" />
          </svg>

          {message && (
            <div className="info-message">{message}</div>
          )}
        </div>
      </div>
    </>
  );
}
