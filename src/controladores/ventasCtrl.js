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

    // Estadísticas
    const [estadisticas] = await conmysql.execute(
      `SELECT 
        COUNT(*) as total_ventas,
        SUM(total_venta) as ingresos_totales,
        AVG(total_venta) as promedio_venta
       FROM ventas
       ${fecha ? 'WHERE DATE(fecha_venta) = ?' : ''}`,
      fecha ? [fecha] : []
    );

    // Productos más vendidos - Consulta corregida
    const [productosVendidos] = await conmysql.execute(
      `SELECT 
        p.nombre,
        SUM(ip.cantidad) as total_vendido,
        SUM(ip.subtotal) as ingresos_producto
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

    res.json({
      ventas,
      estadisticas: estadisticas[0],
      productos_mas_vendidos: productosVendidos
    });

  } catch (error) {
    console.error('Error en reportes:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};