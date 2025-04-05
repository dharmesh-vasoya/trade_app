// frontend/src/App.jsx
import React from 'react';
import './App.css'; // Use updated CSS
import StockDataViewer from './components/StockDataViewer';

function App() {
  return (
    // App div now controls flex direction and ensures minimum height
    <div className="App">
      <h1 className="text-3xl font-bold text-gray-800 mb-4"> {/* Example Tailwind */}
          Stock Market Analysis
      </h1>
      {/* StockDataViewer will contain selectors and chart */}
      <StockDataViewer />
    </div>
  );
}

export default App;