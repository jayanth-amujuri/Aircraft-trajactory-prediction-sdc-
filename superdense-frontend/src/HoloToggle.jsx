import React, { useId } from 'react';
import './HoloToggle.css';

export default function HoloToggle({ checked, onChange, labelOn = 'On', labelOff = 'Off', className }) {
  const id = useId();
  return (
    <div className={`holo-toggle-container ${className || ''}`}>
      <div className="holo-toggle-wrap">
        <input
          id={id}
          type="checkbox"
          className="holo-toggle-input"
          checked={!!checked}
          onChange={(e) => onChange?.(e.target.checked)}
        />
        <label htmlFor={id} className="holo-toggle-track">
          <div className="holo-track-lines">
            <div className="holo-track-line" />
          </div>
          <div className="holo-toggle-thumb">
            <div className="holo-thumb-core" />
            <div className="holo-thumb-inner" />
            <div className="holo-thumb-scan" />
            <div className="holo-thumb-particles">
              <div className="holo-thumb-particle" />
              <div className="holo-thumb-particle" />
              <div className="holo-thumb-particle" />
              <div className="holo-thumb-particle" />
              <div className="holo-thumb-particle" />
            </div>
          </div>
          <div className="holo-toggle-data">
            <span className="holo-data-text off">{labelOff}</span>
            <span className="holo-data-text on">{labelOn}</span>
            <span className="holo-status-indicator off" />
            <span className="holo-status-indicator on" />
          </div>
          <div className="holo-energy-rings">
            <span className="holo-energy-ring" />
            <span className="holo-energy-ring" />
            <span className="holo-energy-ring" />
          </div>
          <div className="holo-interface-lines">
            <span className="holo-interface-line" />
            <span className="holo-interface-line" />
            <span className="holo-interface-line" />
            <span className="holo-interface-line" />
            <span className="holo-interface-line" />
            <span className="holo-interface-line" />
          </div>
          <span className="holo-toggle-reflection" />
          <span className="holo-glow" />
        </label>
      </div>
      <div className="holo-toggle-caption">Simulate Eve</div>
    </div>
  );
}


