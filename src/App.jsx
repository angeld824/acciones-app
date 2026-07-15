import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [acciones, setAcciones] = useState([])
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
    soporte: '',
  })

  // Cargar acciones de localStorage al iniciar
  useEffect(() => {
    const saved = localStorage.getItem('acciones')
    if (saved) {
      const accionesGuardadas = JSON.parse(saved)
      const accionesConEstados = accionesGuardadas.map(a => ({
        ...a,
        estado: calcularEstadoAutomatico(a)
      }))
      setAcciones(accionesConEstados)
    }
  }, [])

  // Guardar acciones en localStorage cada vez que cambien
  useEffect(() => {
    localStorage.setItem('acciones', JSON.stringify(acciones))
  }, [acciones])

  // Calcular estado automático basado en fechas
  const calcularEstadoAutomatico = (accion) => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const fechaInicio = new Date(accion.inicio)
    const fechaFin = new Date(accion.fin)

    // Si estado está en 'cerradaSinCobro' o 'cerradaCobrada', no cambiar automáticamente
    if (accion.estado === 'cerradaSinCobro' || accion.estado === 'cerradaCobrada') {
      return accion.estado
    }

    // Si ya pasó la fecha fin, es vencida
    if (hoy > fechaFin) {
      return 'vencida'
    }

    // Si hoy es >= fecha inicio, es activa
    if (hoy >= fechaInicio) {
      return 'activa'
    }

    // Si aún no inició, es nueva
    return 'nueva'
  }

  // Calcular días hasta vencimiento
  const diasHastaVencimiento = (fechaFin) => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const fin = new Date(fechaFin)
    fin.setHours(0, 0, 0, 0)
    const diferencia = fin - hoy
    const dias = Math.ceil(diferencia / (1000 * 60 * 60 * 24))
    return dias
  }

  // Verificar si es urgente
  const esUrgente = (accion) => {
    const dias = diasHastaVencimiento(accion.fin)
    return dias <= 3 && accion.estado !== 'cerradaCobrada' && accion.estado !== 'cerradaSinCobro'
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

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!formData.proveedor || !formData.marca || !formData.nombre || !formData.inicio || !formData.fin) {
      alert('Por favor completa todos los campos obligatorios')
      return
    }

    const nuevaAccion = {
      id: Date.now(),
      ...formData,
      estado: 'nueva',
      fechaCreacion: new Date().toLocaleDateString('es-AR'),
    }

    setAcciones([...acciones, calcularEstadoAutomatico(nuevaAccion)])
    setFormData({
      proveedor: '',
      marca: '',
      nombre: '',
      inicio: '',
      fin: '',
      cierreConciliacion: '',
      facturacion: '',
      soporte: '',
    })
  }

  const cambiarEstado = (id, nuevoEstado) => {
    setAcciones(acciones.map(accion =>
      accion.id === id ? { ...accion, estado: nuevoEstado } : accion
    ))
  }

  const eliminarAccion = (id) => {
    setAcciones(acciones.filter(accion => accion.id !== id))
  }

  // Obtener opciones únicas para filtros
  const marcasUnicas = [...new Set(acciones.map(a => a.marca))].sort()
  const proveedoresUnicos = [...new Set(acciones.map(a => a.proveedor))].sort()
  const mesesUnicos = [...new Set(acciones.map(a => a.inicio.substring(0, 7)))].sort().reverse()

  // Aplicar filtros
  const accionesFiltradas = acciones.filter(accion => {
    if (filtros.mes && !accion.inicio.startsWith(filtros.mes)) return false
    if (filtros.marca && accion.marca !== filtros.marca) return false
    if (filtros.proveedor && accion.proveedor !== filtros.proveedor) return false
    return true
  })

  // Agrupar por estado
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

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1 style={{ marginBottom: '30px', color: '#333' }}>Acciones Comerciales</h1>

      {/* FORMULARIO */}
      <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #ddd' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '16px', color: '#333' }}>Nueva acción</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <input
              type="text"
              name="proveedor"
              placeholder="Proveedor *"
              value={formData.proveedor}
              onChange={handleInputChange}
              required
              style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
            <input
              type="text"
              name="marca"
              placeholder="Marca *"
              value={formData.marca}
              onChange={handleInputChange}
              required
              style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
            <input
              type="text"
              name="nombre"
              placeholder="Nombre de acción *"
              value={formData.nombre}
              onChange={handleInputChange}
              required
              style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>Inicio *</label>
              <input
                type="date"
                name="inicio"
                value={formData.inicio}
                onChange={handleInputChange}
                required
                style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px', width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>Fin *</label>
              <input
                type="date"
                name="fin"
                value={formData.fin}
                onChange={handleInputChange}
                required
                style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px', width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>Cierre evidencias</label>
              <input
                type="date"
                name="cierreConciliacion"
                value={formData.cierreConciliacion}
                onChange={handleInputChange}
                style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px', width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>Facturación</label>
              <input
                type="date"
                name="facturacion"
                value={formData.facturacion}
                onChange={handleInputChange}
                style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px', width: '100%' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>Soporte</label>
            <textarea
              name="soporte"
              placeholder="Descripción del soporte (precio, artículos, outlet, etc)"
              value={formData.soporte}
              onChange={handleInputChange}
              style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px', width: '100%', minHeight: '80px', fontFamily: 'inherit' }}
            />
          </div>

          <button
            type="submit"
            style={{
              padding: '10px 20px',
              background: '#007BFF',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Agregar acción
          </button>
        </form>
      </div>

      {/* FILTROS */}
      <div style={{ background: 'white', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ddd', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>Mes</label>
          <select
            name="mes"
            value={filtros.mes}
            onChange={handleFiltroChange}
            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '100%' }}
          >
            <option value="">Todos los meses</option>
            {mesesUnicos.map(mes => (
              <option key={mes} value={mes}>{mes}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>Marca</label>
          <select
            name="marca"
            value={filtros.marca}
            onChange={handleFiltroChange}
            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '100%' }}
          >
            <option value="">Todas las marcas</option>
            {marcasUnicas.map(marca => (
              <option key={marca} value={marca}>{marca}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666' }}>Proveedor</label>
          <select
            name="proveedor"
            value={filtros.proveedor}
            onChange={handleFiltroChange}
            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '100%' }}
          >
            <option value="">Todos los proveedores</option>
            {proveedoresUnicos.map(proveedor => (
              <option key={proveedor} value={proveedor}>{proveedor}</option>
            ))}
          </select>
        </div>
      </div>

      {/* LISTADO POR ESTADO */}
      {estados.map(estado => (
        <div key={estado.id} style={{ marginBottom: '24px' }}>
          <h2 style={{
            fontSize: '16px',
            padding: '12px',
            background: estado.color,
            borderRadius: '6px',
            marginBottom: '12px',
            color: '#333',
            fontWeight: estado.isUrgente ? '600' : '500'
          }}>
            {estado.label} ({accionesPorEstado[estado.id].length})
          </h2>

          {accionesPorEstado[estado.id].length === 0 ? (
            <p style={{ color: '#999', fontStyle: 'italic', padding: '12px' }}>Sin acciones en este estado</p>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {accionesPorEstado[estado.id].map(accion => {
                const dias = diasHastaVencimiento(accion.fin)
                return (
                  <div
                    key={accion.id}
                    style={{
                      background: 'white',
                      border: estado.isUrgente ? '2px solid #dc3545' : '1px solid #ddd',
                      borderRadius: '6px',
                      padding: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                      <div>
                        <h3 style={{ margin: '0 0 4px 0', color: '#333', fontSize: '15px' }}>{accion.nombre}</h3>
                        <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '13px' }}>
                          {accion.proveedor} • {accion.marca}
                        </p>
                        <p style={{ margin: '0', color: '#999', fontSize: '12px' }}>Creada: {accion.fechaCreacion}</p>
                      </div>
                      {dias <= 3 && dias > -1 && (
                        <span style={{ background: '#dc3545', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '500' }}>
                          {dias === 0 ? 'Hoy' : `${dias} días`}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '12px', fontSize: '13px' }}>
                      <div>
                        <span style={{ color: '#666' }}>Inicio:</span> <strong>{accion.inicio}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#666' }}>Fin:</span> <strong>{accion.fin}</strong>
                      </div>
                      {accion.cierreConciliacion && (
                        <div>
                          <span style={{ color: '#666' }}>Cierre:</span> <strong>{accion.cierreConciliacion}</strong>
                        </div>
                      )}
                      {accion.facturacion && (
                        <div>
                          <span style={{ color: '#666' }}>Facturación:</span> <strong>{accion.facturacion}</strong>
                        </div>
                      )}
                    </div>

                    {accion.soporte && (
                      <div style={{ marginBottom: '12px', padding: '8px', background: '#f5f5f5', borderRadius: '4px', fontSize: '13px' }}>
                        <span style={{ color: '#666' }}>Soporte:</span> {accion.soporte}
                      </div>
                    )}

                    {/* BOTONES DE ESTADO */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      {['nueva', 'activa', 'vencida', 'cerradaSinCobro', 'cerradaCobrada'].map(nuevoEstado => (
                        <button
                          key={nuevoEstado}
                          onClick={() => cambiarEstado(accion.id, nuevoEstado)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            border: accion.estado === nuevoEstado ? '2px solid #007BFF' : '1px solid #ddd',
                            background: accion.estado === nuevoEstado ? '#E7F3FF' : 'white',
                            color: accion.estado === nuevoEstado ? '#007BFF' : '#666',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: accion.estado === nuevoEstado ? '500' : 'normal',
                          }}
                        >
                          {nuevoEstado === 'nueva' ? 'Nueva' : nuevoEstado === 'activa' ? 'Activa' : nuevoEstado === 'vencida' ? 'Vencida' : nuevoEstado === 'cerradaSinCobro' ? 'Sin cobro' : 'Cobrada'}
                        </button>
                      ))}
                    </div>

                    {/* BOTÓN ELIMINAR */}
                    <button
                      onClick={() => eliminarAccion(accion.id)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        background: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Eliminar
                    </button>
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