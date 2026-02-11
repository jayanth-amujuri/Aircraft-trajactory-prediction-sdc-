import { createContext, useContext, useState } from 'react';

const SimulationContext = createContext(null);

export function SimulationProvider({ children }) {
  const [message, setMessage] = useState('00');
  const [eveEnabled, setEveEnabled] = useState(false);

  const value = {
    message,
    setMessage,
    eveEnabled,
    setEveEnabled,
  };

  return (
    <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>
  );
}

export function useSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error('useSimulation must be used within SimulationProvider');
  return ctx;
}


