import { Route, Routes, useParams } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import About from './pages/About.jsx'
import CapstonePaper from './pages/CapstonePaper.jsx'
import Catalogue from './pages/Catalogue.jsx'
import Home from './pages/Home.jsx'
import Lookup from './pages/Lookup.jsx'
import Product from './pages/Product.jsx'
import TechnicalOverview from './pages/TechnicalOverview.jsx'

function ProductRoute() {
  // Remount per product so opened evidence panels don't carry over when
  // moving between products of the same brand.
  const { id } = useParams()
  return <Product key={id} />
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/catalogue" element={<Catalogue />} />
        <Route path="/product/:id" element={<ProductRoute />} />
        <Route path="/lookup" element={<Lookup />} />
        <Route path="/about" element={<About />} />
        <Route path="/capstone-paper" element={<CapstonePaper />} />
        <Route path="/technical-overview" element={<TechnicalOverview />} />
      </Route>
    </Routes>
  )
}
