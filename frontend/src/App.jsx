// frontend/src/App.jsx
import React from 'react';
import './App.css'; // Use updated CSS
import StockDataViewer from './components/StockDataViewer';

function App() {
  return (
    <div className="App">
      <h1 className="text-3xl font-bold text-gray-800 mb-4">
          Stock Market Analysis
      </h1>
      <StockDataViewer />
    </div>
  );
}

export default App;