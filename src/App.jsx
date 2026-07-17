import { useState, useEffect } from 'react'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query } from 'firebase/firestore'
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth'
import './App.css'

const firebaseConfig = {
  apiKey: "AIzaSyDjIhvF_SapzXcqhQcLzQWgyyJJ-6_t1Ns",
  authDomain: "acciones-app-502711.firebaseapp.com",
  projectId: "acciones-app-502711",
  storageBucket: "acciones-app-502711.firebasestorage.app",
  messagingSenderId: "216603243034",
  appId: "1:216603243034:web:ba1e6fb62b45aaeb4497a3",
  measurementId: "G-GFRPF35YGL"
};

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const auth = getAuth(app)
const googleProvider = new GoogleAuthProvider()

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [acciones, setAcciones] = useState([])
  const [tasaCambio, setTasaCambio] = useState(7000)
  const [filtros, setFiltros] = useState({
    mes: '',
    marca: '',
    proveedor: '',
  })
  const [formData, setFormData] = useState({
    proveedor: '',
    marca: '',
    nombre: '',
    inicio: '',
    fin: '',
    cierreConciliacion: '',
    facturacion: '',
    monto: '',
    moneda: 'Gs',
    tipoSoporte: 'Acuerdo Comercial',
    soporte: '',
  })

  // Verificar si usuario está autenticado
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })

    return () => unsubscribeAuth()
  }, [])

  // Cargar acciones solo si está autenticado
  useEffect(() => {
    if (!user) return

    const q = query(collection(db, 'acciones'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const accionesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        estado: calcularEstadoAutomatico(doc.data()),
        monto: doc.data().monto || 0,
        moneda: doc.data().moneda || 'Gs',
        tipoSoporte: doc.data().tipoSoporte || 'Acuerdo Comercial',
      }))
      setAcciones(accionesData)
    })

    return () => unsubscribe()
  }, [user])

  const loginConGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      alert('Error al iniciar sesión: ' + error.message)
    }
  }

  const logout = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      alert('Error al cerrar sesión: ' + error.message)
    }
  }

  const calcularEstadoAutomatico = (accion) => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const fechaInicio = new Date(accion.inicio)
    const fechaFin = new Date(accion.fin)

    if (accion.estado === 'cerradaSinCobro' || accion.estado === 'cerradaCobrada') {
      return accion.estado
    }

    if (hoy > fechaFin) {
      return 'vencida'
    }

    if (hoy >= fechaInicio) {
      return 'activa'
    }

    return 'nueva'
  }

  const diasHastaVencimiento = (fechaFin) => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const fin = new Date(fechaFin)
    fin.setHours(0, 0, 0, 0)
    const diferencia = fin - hoy
    const dias = Math.ceil(diferencia / (1000 * 60 * 60 * 24))
    return dias
  }

  const esUrgente = (accion) => {
    const dias = diasHastaVencimiento(accion.fin)
    return dias <= 3 && accion.estado !== 'cerradaCobrada' && accion.estado !== 'cerradaSinCobro'
  }

  const calcularTotales = () => {
    const accionesFiltradas = acciones.filter(accion => {
      if (filtros.mes && !accion.inicio.startsWith(filtros.mes)) return false
      if (filtros.marca && accion.marca !== filtros.marca) return false
      if (filtros.proveedor && accion.proveedor !== filtros.proveedor) return false
      return true
    })

    const totales = {
      activos: { gs: 0, usd: 0 },
      sinCobro: { gs: 0, usd: 0 },
      cobrados: { gs: 0, usd: 0 },
    }

    accionesFiltradas.forEach(accion => {
      const monto = accion.monto || 0

      if (accion.estado === 'activa' || accion.estado === 'nueva') {
        if (accion.moneda === 'USD') {
          totales.activos.usd += monto
        } else {
          totales.activos.gs += monto
        }
      } else if (accion.estado === 'cerradaSinCobro' || accion.estado === 'vencida') {
        if (accion.moneda === 'USD') {
          totales.sinCobro.usd += monto
        } else {
          totales.sinCobro.gs += monto
        }
      } else if (accion.estado === 'cerradaCobrada') {
        if (accion.moneda === 'USD') {
          totales.cobrados.usd += monto
        } else {
          totales.cobrados.gs += monto
        }
      }
    })

    return totales
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleFiltroChange = (e) => {
    const { name, value } = e.target
    setFiltros(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleTasaChange = (e) => {
    setTasaCambio(parseFloat(e.target.value) || 0)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.proveedor || !formData.marca || !formData.nombre || !formData.inicio || !formData.fin) {
      alert('Por favor completa todos los campos obligatorios')
      return
    }

    try {
      await addDoc(collection(db, 'acciones'), {
        ...formData,
        monto: parseFloat(formData.monto) || 0,
        estado: 'nueva',
        fechaCreacion: new Date().toLocaleDateString('es-AR'),
        createdAt: new Date(),
      })

      setFormData({
        proveedor: '',
        marca: '',
        nombre: '',
        inicio: '',
        fin: '',
        cierreConciliacion: '',
        facturacion: '',
        monto: '',
        moneda: 'Gs',
        tipoSoporte: 'Acuerdo Comercial',
        soporte: '',
      })
    } catch (error) {
      alert('Error al guardar: ' + error.message)
    }
  }

  const cambiarEstado = async (id, nuevoEstado) => {
    try {
      await updateDoc(doc(db, 'acciones', id), {
        estado: nuevoEstado
      })
    } catch (error) {
      alert('Error al actualizar: ' + error.message)
    }
  }

  const eliminarAccion = async (id) => {
    try {
      await deleteDoc(doc(db, 'acciones', id))
    } catch (error) {
      alert('Error al eliminar: ' + error.message)
    }
  }

  const marcasUnicas = [...new Set(acciones.map(a => a.marca))].sort()
  const proveedoresUnicos = [...new Set(acciones.map(a => a.proveedor))].sort()
  const mesesUnicos = [...new Set(acciones.map(a => a.inicio.substring(0, 7)))].sort().reverse()

  const accionesFiltradas = acciones.filter(accion => {
    if (filtros.mes && !accion.inicio.startsWith(filtros.mes)) return false
    if (filtros.marca && accion.marca !== filtros.marca) return false
    if (filtros.proveedor && accion.proveedor !== filtros.proveedor) return false
    return true
  })

  const accionesPorEstado = {
    urgentes: accionesFiltradas.filter(a => esUrgente(a)),
    nueva: accionesFiltradas.filter(a => a.estado === 'nueva' && !esUrgente(a)),
    activa: accionesFiltradas.filter(a => a.estado === 'activa' && !esUrgente(a)),
    vencida: accionesFiltradas.filter(a => a.estado === 'vencida'),
    cerradaSinCobro: accionesFiltradas.filter(a => a.estado === 'cerradaSinCobro'),
    cerradaCobrada: accionesFiltradas.filter(a => a.estado === 'cerradaCobrada'),
  }

  const estados = [
    { id: 'urgentes', label: '🔴 Urgentes (próximos 3 días)', color: '#F8D7DA', isUrgente: true },
    { id: 'nueva', label: 'Nueva', color: '#FFF3CD', isUrgente: false },
    { id: 'activa', label: 'Activa', color: '#D4EDDA', isUrgente: false },
    { id: 'vencida', label: 'Vencida', color: '#F8D7DA', isUrgente: false },
    { id: 'cerradaSinCobro', label: 'Cerrada sin cobro', color: '#E2E3E5', isUrgente: false },
    { id: 'cerradaCobrada', label: 'Cerrada cobrada', color: '#D1ECF1', isUrgente: false },
  ]

  const totales = calcularTotales()

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', fontSize: '16px', color: '#666' }}>Cargando...</div>
  }

  // PANTALLA DE LOGIN
  if (!user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f5f5f5', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', maxWidth: '400px' }}>
          <h1 style={{ color: '#333', marginBottom: '30px' }}>Acciones Comerciales</h1>
          <p style={{ color: '#666', marginBottom: '30px', fontSize: '14px' }}>Iniciá sesión con tu cuenta de Google</p>
          <button
            onClick={loginConGoogle}
            style={{
              padding: '12px 24px',
              background: '#007BFF',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              width: '100%'
            }}
          >
            Iniciar sesión con Google
          </button>
        </div>
      </div>
    )
  }

  // PANTALLA PRINCIPAL (solo si está autenticado)
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#333', margin: '0' }}>Acciones Comerciales — v2.1 (Firebase + Auth)</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '14px', color: '#666' }}>👤 {user.displayName || user.email}</span>
          <button
            onClick={logout}
            style={{
              padding: '8px 16px',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #ddd' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '16px', color: '#333' }}>Nueva acción</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <input type="text" name="proveedor" placeholder="Proveedor *" value={formData.proveedor} onChange={handleInputChange} required style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
            <input type="text" name="marca" placeholder="Marca *" value={formData.marca} onChange={handleInputChange} required style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
            <input type="text" name="nombre" placeholder="Nombre de acción *" value={formData.nombre} onChange={handleInputChange} required style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>Inicio *</label>
              <input type="date" name="inicio" value={formData.inicio} onChange={handleInputChange} required style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px', width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>Fin *</label>
              <input type="date" name="fin" value={formData.fin} onChange={handleInputChange} required style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px', width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>Cierre evidencias</label>
              <input type="date" name="cierreConciliacion" value={formData.cierreConciliacion} onChange={handleInputChange} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px', width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>Facturación</label>
              <input type="date" name="facturacion" value={formData.facturacion} onChange={handleInputChange} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px', width: '100%' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>Monto</label>
              <input type="number" name="monto" placeholder="0" value={formData.monto} onChange={handleInputChange} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px', width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>Moneda</label>
              <select name="moneda" value={formData.moneda} onChange={handleInputChange} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px', width: '100%' }}>
                <option value="Gs">Guaraní (Gs)</option>
                <option value="USD">Dólar (USD)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>Tipo de soporte</label>
              <select name="tipoSoporte" value={formData.tipoSoporte} onChange={handleInputChange} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px', width: '100%' }}>
                <option value="Acuerdo Comercial">Acuerdo Comercial</option>
                <option value="Soporte Comercial">Soporte Comercial</option>
                <option value="MKT">MKT</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>Soporte / Notas</label>
            <textarea name="soporte" placeholder="Descripción del soporte (precio, artículos, outlet, etc)" value={formData.soporte} onChange={handleInputChange} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px', width: '100%', minHeight: '80px', fontFamily: 'inherit' }} />
          </div>

          <button type="submit" style={{ padding: '10px 20px', background: '#007BFF', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>Agregar acción</button>
        </form>
      </div>

      <div style={{ background: 'white', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ddd', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <label style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>Tasa de cambio (USD → Gs):</label>
        <input type="number" value={tasaCambio} onChange={handleTasaChange} style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', width: '120px', fontSize: '14px' }} />
        <span style={{ fontSize: '12px', color: '#666' }}>1 USD = {tasaCambio.toLocaleString('es-AR')} Gs</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px', marginBottom: '30px' }}>
        <div style={{ background: '#D4EDDA', padding: '16px', borderRadius: '8px', border: '1px solid #c3e6cb' }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px', textTransform: 'uppercase', fontWeight: '600' }}>Total Activos</div>
          {totales.activos.gs > 0 && <div style={{ fontSize: '16px', fontWeight: '600', color: '#155724', marginBottom: '8px' }}>{totales.activos.gs.toLocaleString('es-AR')} Gs</div>}
          {totales.activos.usd > 0 && <div style={{ fontSize: '16px', fontWeight: '600', color: '#155724' }}>${totales.activos.usd.toLocaleString('es-AR')} USD</div>}
          {totales.activos.gs === 0 && totales.activos.usd === 0 && <div style={{ fontSize: '16px', fontWeight: '600', color: '#155724' }}>$ 0</div>}
        </div>
        <div style={{ background: '#E2E3E5', padding: '16px', borderRadius: '8px', border: '1px solid #d6d8db' }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px', textTransform: 'uppercase', fontWeight: '600' }}>Total Sin Cobro</div>
          {totales.sinCobro.gs > 0 && <div style={{ fontSize: '16px', fontWeight: '600', color: '#383d41', marginBottom: '8px' }}>{totales.sinCobro.gs.toLocaleString('es-AR')} Gs</div>}
          {totales.sinCobro.usd > 0 && <div style={{ fontSize: '16px', fontWeight: '600', color: '#383d41' }}>${totales.sinCobro.usd.toLocaleString('es-AR')} USD</div>}
          {totales.sinCobro.gs === 0 && totales.sinCobro.usd === 0 && <div style={{ fontSize: '16px', fontWeight: '600', color: '#383d41' }}>$ 0</div>}
        </div>
        <div style={{ background: '#D1ECF1', padding: '16px', borderRadius: '8px', border: '1px solid #bee5eb' }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px', textTransform: 'uppercase', fontWeight: '600' }}>Total Cobrados</div>
          {totales.cobrados.gs > 0 && <div style={{ fontSize: '16px', fontWeight: '600', color: '#0c5460', marginBottom: '8px' }}>{totales.cobrados.gs.toLocaleString('es-AR')} Gs</div>}
          {totales.cobrados.usd > 0 && <div style={{ fontSize: '16px', fontWeight: '600', color: '#0c5460' }}>${totales.cobrados.usd.toLocaleString('es-AR')} USD</div>}
          {totales.cobrados.gs === 0 && totales.cobrados.usd === 0 && <div style={{ fontSize: '16px', fontWeight: '600', color: '#0c5460' }}>$ 0</div>}
        </div>
      </div>

      <div style={{ background: 'white', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ddd', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>Mes</label>
          <select name="mes" value={filtros.mes} onChange={handleFiltroChange} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '100%' }}>
            <option value="">Todos los meses</option>
            {mesesUnicos.map(mes => <option key={mes} value={mes}>{mes}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>Marca</label>
          <select name="marca" value={filtros.marca} onChange={handleFiltroChange} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '100%' }}>
            <option value="">Todas las marcas</option>
            {marcasUnicas.map(marca => <option key={marca} value={marca}>{marca}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>Proveedor</label>
          <select name="proveedor" value={filtros.proveedor} onChange={handleFiltroChange} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '100%' }}>
            <option value="">Todos los proveedores</option>
            {proveedoresUnicos.map(proveedor => <option key={proveedor} value={proveedor}>{proveedor}</option>)}
          </select>
        </div>
      </div>

      {estados.map(estado => (
        <div key={estado.id} style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', padding: '12px', background: estado.color, borderRadius: '6px', marginBottom: '12px', color: '#333', fontWeight: estado.isUrgente ? '600' : '500' }}>{estado.label} ({accionesPorEstado[estado.id].length})</h2>

          {accionesPorEstado[estado.id].length === 0 ? (
            <p style={{ color: '#999', fontStyle: 'italic', padding: '12px' }}>Sin acciones en este estado</p>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {accionesPorEstado[estado.id].map(accion => {
                const dias = diasHastaVencimiento(accion.fin)
                return (
                  <div key={accion.id} style={{ background: 'white', border: estado.isUrgente ? '2px solid #dc3545' : '1px solid #ddd', borderRadius: '6px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                      <div>
                        <h3 style={{ margin: '0 0 4px 0', color: '#333', fontSize: '15px' }}>{accion.nombre}</h3>
                        <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '13px' }}>{accion.proveedor} • {accion.marca}</p>
                        <p style={{ margin: '0', color: '#999', fontSize: '12px' }}>Creada: {accion.fechaCreacion}</p>
                      </div>
                      {dias <= 3 && dias > -1 && <span style={{ background: '#dc3545', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '500' }}>{dias === 0 ? 'Hoy' : `${dias} días`}</span>}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '12px', fontSize: '13px' }}>
                      <div><span style={{ color: '#666' }}>Inicio:</span> <strong>{accion.inicio}</strong></div>
                      <div><span style={{ color: '#666' }}>Fin:</span> <strong>{accion.fin}</strong></div>
                      {accion.cierreConciliacion && <div><span style={{ color: '#666' }}>Cierre:</span> <strong>{accion.cierreConciliacion}</strong></div>}
                      {accion.facturacion && <div><span style={{ color: '#666' }}>Facturación:</span> <strong>{accion.facturacion}</strong></div>}
                      {accion.monto && <div><span style={{ color: '#666' }}>Monto:</span> <strong>{accion.monto.toLocaleString('es-AR')} {accion.moneda}</strong></div>}
                      <div><span style={{ color: '#666' }}>Tipo:</span> <strong style={{ fontSize: '12px', background: '#f0f0f0', padding: '2px 6px', borderRadius: '3px' }}>{accion.tipoSoporte}</strong></div>
                    </div>

                    {accion.soporte && <div style={{ marginBottom: '12px', padding: '8px', background: '#f5f5f5', borderRadius: '4px', fontSize: '13px' }}><span style={{ color: '#666' }}>Soporte:</span> {accion.soporte}</div>}

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      {['nueva', 'activa', 'vencida', 'cerradaSinCobro', 'cerradaCobrada'].map(nuevoEstado => (
                        <button key={nuevoEstado} onClick={() => cambiarEstado(accion.id, nuevoEstado)} style={{ padding: '6px 12px', fontSize: '12px', border: accion.estado === nuevoEstado ? '2px solid #007BFF' : '1px solid #ddd', background: accion.estado === nuevoEstado ? '#E7F3FF' : 'white', color: accion.estado === nuevoEstado ? '#007BFF' : '#666', borderRadius: '4px', cursor: 'pointer', fontWeight: accion.estado === nuevoEstado ? '500' : 'normal' }}>
                          {nuevoEstado === 'nueva' ? 'Nueva' : nuevoEstado === 'activa' ? 'Activa' : nuevoEstado === 'vencida' ? 'Vencida' : nuevoEstado === 'cerradaSinCobro' ? 'Sin cobro' : 'Cobrada'}
                        </button>
                      ))}
                    </div>

                    <button onClick={() => eliminarAccion(accion.id)} style={{ padding: '6px 12px', fontSize: '12px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Eliminar</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default App