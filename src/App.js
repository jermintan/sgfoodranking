import React from 'react';
import { Routes, Route } from 'react-router-dom';
import './App.css';
import Header from './components/Header';
import EateryGrid from './components/EateryGrid';
import EateryDetailPage from './components/EateryDetailPage';

function App() {
  return (
    <div className="App">
      <Header />
      <main>
        <Routes>
          {/* Route 1: The homepage, shows the grid */}
          <Route path="/" element={<EateryGrid />} />

          {/* Route 2: The detail page. ':id' is a dynamic parameter */}
          <Route path="/eatery/:id" element={<EateryDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;