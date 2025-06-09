
import React from 'react';
// This component is a pass-through. The main application logic and layout 
// are now managed by src/App.tsx which renders src/pages/HomePage.tsx.
// This file can be considered deprecated or for future root-level routing if needed.
import MainApp from './src/App';

const App: React.FC = () => {
  return <MainApp />;
};

export default App;
