import { Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import About from './pages/About.jsx'
import CapstonePaper from './pages/CapstonePaper.jsx'
import Home from './pages/Home.jsx'
import TechnicalOverview from './pages/TechnicalOverview.jsx'

function HomeRoute() {
  // Remount Home on every navigation to "/" so opening a different
  // previous cart re-initializes its messages instead of patching state.
  const location = useLocation()
  return <Home key={location.key} />
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/about" element={<About />} />
        <Route path="/capstone-paper" element={<CapstonePaper />} />
        <Route path="/technical-overview" element={<TechnicalOverview />} />
      </Route>
    </Routes>
  )
}
