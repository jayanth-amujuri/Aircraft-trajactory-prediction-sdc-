// config.js

// Configuration for different backend phases
const config = {
  // Error Correction Service
  errorCorrection: {
    baseURL: 'http://localhost:5008', // Primary URL - matches the Flask server's port
    endpoints: {
      compareCorrected: '/compare33_corrected' // Endpoint for error correction with Shor code
    },
    // Fallback URLs in case the primary is unavailable
    // ✅ CORRECTED: Removed incorrect port 5000 fallbacks.
    // The error correction service ONLY runs on port 5008.
    fallbackURLs: [
      'http://127.0.0.1:5008', // localhost alternative for the same service
    ]
  },
  
  // Testing Phase - uses app.py on port 5000
  testing: {
    baseURL: 'http://localhost:5000',
    endpoints: {
      runSimulation: '/api/run_simulation',
      health: '/api/health'
    }
  },
  
  // Application Phase - uses application.py on port 5001
  application: {
    baseURL: 'http://localhost:5001',
    endpoints: {
      qkdSimulation: '/api/qkd_simulation',
      superdenseCoding: '/api/superdense_coding',
      fullSimulation: '/api/full_simulation',
      health: '/api/health'
    }
  }
};

export default config;