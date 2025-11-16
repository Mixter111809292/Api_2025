import { conmysql } from '../db.js';

export const obtenerReportesVentas = async (req, res) => {
  try {
    const { fecha } = req.query;
    
    let query = `
      SELECT v.*, u.nombre as nombre_usuario, p.metodo_entrega
      FROM ventas v
      JOIN usuarios u ON v.usuario_id = u.id
      JOIN pedidos p ON v.pedido_id = p.id
    `;
    
    let params = [];

    if (fecha) {
      query += ' WHERE DATE(v.fecha_venta) = ?';
      params.push(fecha);
    }

    query += ' ORDER BY v.fecha_venta DESC';

    const [ventas] = await conmysql.execute(query, params);

    // Estadísticas (FORZAR números)
    const [estadisticasRaw] = await conmysql.execute(
      `SELECT 
        COUNT(*) AS total_ventas,
        SUM(total_venta)+0 AS ingresos_totales,
        AVG(total_venta)+0 AS promedio_venta
      FROM ventas
      ${fecha ? 'WHERE DATE(fecha_venta) = ?' : ''}`,
      fecha ? [fecha] : []
    );

    const estadisticas = {
      total_ventas: Number(estadisticasRaw[0].total_ventas || 0),
      ingresos_totales: Number(estadisticasRaw[0].ingresos_totales || 0),
      promedio_venta: Number(estadisticasRaw[0].promedio_venta || 0),
    };

    // Productos más vendidos - valores convertidos a número
    const [productosVendidosRaw] = await conmysql.execute(
      `SELECT 
        p.nombre,
        SUM(ip.cantidad) AS total_vendido,
        SUM(ip.subtotal)+0 AS ingresos_producto
      FROM items_pedido ip
      JOIN productos p ON ip.producto_id = p.id
      JOIN pedidos pd ON ip.pedido_id = pd.id
      JOIN ventas v ON pd.id = v.pedido_id
      ${fecha ? 'WHERE DATE(v.fecha_venta) = ?' : ''}
      GROUP BY p.id, p.nombre
      ORDER BY total_vendido DESC
      LIMIT 10`,
      fecha ? [fecha] : []
    );

    const productos_mas_vendidos = productosVendidosRaw.map(p => ({
      nombre: p.nombre,
      total_vendido: Number(p.total_vendido || 0),
      ingresos_producto: Number(p.ingresos_producto || 0)
    }));

    res.json({
      ventas,
      estadisticas,
      productos_mas_vendidos
    });

  } catch (error) {
    console.error('Error en reportes:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};
