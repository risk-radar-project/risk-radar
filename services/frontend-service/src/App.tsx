import { useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import './App.css';

// Placeholder components
const Home = () => <div>Home Page</div>;
const About = () => <div>About Page</div>;
const Dashboard = () => <div>Dashboard Page</div>;

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Risk Radar</h1>
        <nav>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/about">About</Link></li>
            <li><Link to="/dashboard">Dashboard</Link></li>
          </ul>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>

      <footer>
        <p>Risk Radar Frontend - Version 0.1.0</p>
        <div className="counter">
          <button onClick={() => setCount((count) => count + 1)}>
            count is {count}
          </button>
        </div>
      </footer>
    </div>
  );
}

export default App;