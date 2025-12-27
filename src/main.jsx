import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Cái này giúp web full màn hình và nền đen
const globalStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  background: '#000000', // Màu đen vũ trụ
  overflow: 'hidden',
  margin: 0,
  padding: 0
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <div style={globalStyle}>
      <App />
    </div>
  </React.StrictMode>,
)