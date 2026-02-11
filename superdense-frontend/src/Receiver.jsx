import React, { useState, useRef, useEffect } from "react";
import "./Receiver.css";

// SVG Icons for different log statuses
const StatusIcons = {
  progress: (
    <svg viewBox="0 0 24 24" width="18" height="18" className="log-icon spinner">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
    </svg>
  ),
  success: (
    <svg viewBox="0 0 24 24" width="18" height="18" className="log-icon log-icon-success">
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" width="18" height="18" className="log-icon log-icon-error">
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" width="18" height="18" className="log-icon log-icon-info">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  ),
};

export default function Receiver() {
  const [decodedResult, setDecodedResult] = useState(null);
  const [progressLogs, setProgressLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const eventSourceRef = useRef(null);
  const logsEndRef = useRef(null);

  // Auto-scroll to the bottom of the logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [progressLogs]);

  const fetchDecodedJobs = () => {
    setLoading(true);
    setError(null);
    setDecodedResult(null);
    setProgressLogs([]);
    setProgress(0);

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource("http://localhost:5006/sdc/receive-stream");
    eventSourceRef.current = es;

    es.onopen = () => {
      setProgressLogs(prev => [...prev, { type: 'info', message: 'Connection opened. Searching for pending jobs...' }]);
    };

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'start') {
        setProgressLogs(prev => [...prev, { type: 'info', message: `Found ${data.total_jobs} jobs to process.` }]);
      } else if (data.type === 'progress') {
        setProgress((data.current_job / data.total_jobs) * 100);
        setProgressLogs(prev => {
          const existingLogIndex = prev.findIndex(log => log.job_id === data.job_id);
          const newLog = {
            job_id: data.job_id,
            type: data.status || 'progress',
            message: `[${data.current_job}/${data.total_jobs}] Job ${data.job_id.slice(0, 10)}...: ${data.message}`
          };
          if (existingLogIndex > -1) {
            const updatedLogs = [...prev];
            updatedLogs[existingLogIndex] = newLog;
            return updatedLogs;
          }
          return [...prev, newLog];
        });
      } else if (data.type === 'done') {
        setDecodedResult(data.result);
        setProgress(100);
        setProgressLogs(prev => [...prev, { type: 'success', message: 'All jobs processed successfully!' }]);
        es.close();
        setLoading(false);
      } else if (data.type === 'error') {
        setError(data.message);
        setProgressLogs(prev => [...prev, { type: 'error', message: `ERROR: ${data.message}` }]);
        es.close();
        setLoading(false);
      }
    };

    es.onerror = () => {
      setError("Connection to the server failed. Make sure the backend is running.");
      es.close();
      setLoading(false);
    };
  };

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleCopyBinary = (binary) => {
    navigator.clipboard.writeText(binary);
    alert("✅ Full binary message copied!");
  };

  return (
    <div className="ibm-cloud-page">
      <h1>Receive via Superdense Coding</h1>

      <div className="card sdc-form">
        <button onClick={fetchDecodedJobs} disabled={loading} className="action-btn">
          {loading ? "Processing..." : "Fetch Pending Jobs"}
        </button>
      </div>

      {error && <div className="error-box">Error: {error}</div>}

      {(loading || progressLogs.length > 1) && (
        <div className="card live-status">
            <h3>Live Status</h3>
            <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="progress-logs">
                <ul>
                    {progressLogs.map((log, index) => (
                    <li key={index} className={`log-item log-${log.type}`}>
                        {StatusIcons[log.type]}
                        <span>{log.message}</span>
                    </li>
                    ))}
                    <div ref={logsEndRef} />
                </ul>
            </div>
        </div>
      )}

      {decodedResult && (
        <div className="card sdc-result">
          <h2>✅ Decoded Message</h2>
          <div className="result-grid">
            <div className="result-item full-width">
              <strong>Full Binary Message:</strong>
              <p className="binary-string">{decodedResult.full_binary}</p>
              <button
                className="copy-btn"
                onClick={() => handleCopyBinary(decodedResult.full_binary)}
              >
                Copy Binary
              </button>
            </div>
            <div className="result-item">
              <strong>Latitude:</strong> {decodedResult.latitude}
            </div>
            <div className="result-item">
              <strong>Longitude:</strong> {decodedResult.longitude}
            </div>
            <div className="result-item">
              <strong>Status:</strong> {decodedResult.restricted_status}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}