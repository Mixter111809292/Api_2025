import { conmysql } from '../db.js';

export const crearPedido = async (req, res) => {
  const connection = await conmysql.getConnection();
  
  try {
    await connection.beginTransaction();

    const { metodo_entrega, direccion_entrega, telefono_contacto, observaciones, items } = req.body;
    const usuario_id = req.user.id;

    if (!metodo_entrega || !items || items.length === 0) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }

    // Calcular total y verificar stock
    let total = 0;
    for (const item of items) {
      const [productoRows] = await connection.execute(
        'SELECT precio, stock FROM productos WHERE id = ? AND disponible = TRUE',
        [item.producto_id]
      );

      if (productoRows.length === 0) {
        throw new Error(`Producto con ID ${item.producto_id} no disponible`);
      }

      const producto = productoRows[0];
      if (producto.stock < item.cantidad) {
        throw new Error(`Stock insuficiente para el producto ID ${item.producto_id}`);
      }

      total += producto.precio * item.cantidad;
    }

    // Crear pedido
    const [pedidoResult] = await connection.execute(
      'INSERT INTO pedidos (usuario_id, total, metodo_entrega, direccion_entrega, telefono_contacto, observaciones) VALUES (?, ?, ?, ?, ?, ?)',
      [usuario_id, total, metodo_entrega, direccion_entrega, telefono_contacto, observaciones]
    );

    const pedido_id = pedidoResult.insertId;

    // Crear items del pedido y actualizar stock
    for (const item of items) {
      const [productoRows] = await connection.execute(
        'SELECT precio FROM productos WHERE id = ?',
        [item.producto_id]
      );
      
      const producto = productoRows[0];
      const subtotal = producto.precio * item.cantidad;

      await connection.execute(
        'INSERT INTO items_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
        [pedido_id, item.producto_id, item.cantidad, producto.precio, subtotal]
      );

      // Actualizar stock
      await connection.execute(
        'UPDATE productos SET stock = stock - ? WHERE id = ?',
        [item.cantidad, item.producto_id]
      );
    }

    await connection.commit();

    res.status(201).json({ 
      message: 'Pedido creado exitosamente',
      pedido_id,
      total
    });

  } catch (error) {
    await connection.rollback();
    res.status(400).json({ message: error.message });
  } finally {
    connection.release();
  }
};

export const obtenerMisPedidos = async (req, res) => {
  try {
    // Primero obtener los pedidos
    const [pedidos] = await conmysql.execute(
      `SELECT p.* 
       FROM pedidos p
       WHERE p.usuario_id = ?
       ORDER BY p.fecha_pedido DESC`,
      [req.user.id]
    );

    // Para cada pedido, obtener sus items
    const pedidosConItems = await Promise.all(
      pedidos.map(async (pedido) => {
        const [items] = await conmysql.execute(
          `SELECT ip.*, pr.nombre as nombre_producto
           FROM items_pedido ip
           JOIN productos pr ON ip.producto_id = pr.id
           WHERE ip.pedido_id = ?`,
          [pedido.id]
        );
        
        return {
          ...pedido,
          items: items
        };
      })
    );

    res.json(pedidosConItems);
  } catch (error) {
    console.error('Error obteniendo pedidos:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};

export const obtenerTodosPedidos = async (req, res) => {
  try {
    // Primero obtener los pedidos con info del usuario
    const [pedidos] = await conmysql.execute(
      `SELECT p.*, u.nombre as nombre_usuario, u.email
       FROM pedidos p
       JOIN usuarios u ON p.usuario_id = u.id
       ORDER BY p.fecha_pedido DESC`
    );

    // Para cada pedido, obtener sus items
    const pedidosConItems = await Promise.all(
      pedidos.map(async (pedido) => {
        const [items] = await conmysql.execute(
          `SELECT ip.*, pr.nombre as nombre_producto
           FROM items_pedido ip
           JOIN productos pr ON ip.producto_id = pr.id
           WHERE ip.pedido_id = ?`,
          [pedido.id]
        );
        
        return {
          ...pedido,
          items: items
        };
      })
    );

    res.json(pedidosConItems);
  } catch (error) {
    console.error('Error obteniendo pedidos:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};

export const actualizarEstadoPedido = async (req, res) => {
  const connection = await conmysql.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { estado } = req.body;

    if (!estado) {
      return res.status(400).json({ message: 'Estado es requerido' });
    }

    const [result] = await connection.execute(
      'UPDATE pedidos SET estado = ?, fecha_confirmacion = CASE WHEN ? = "confirmado" AND fecha_confirmacion IS NULL THEN NOW() ELSE fecha_confirmacion END, fecha_completado = CASE WHEN ? = "completado" THEN NOW() ELSE fecha_completado END WHERE id = ?',
      [estado, estado, estado, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Pedido no encontrado' });
    }

    // Si el pedido se completa, crear registro en ventas
    if (estado === 'completado') {
      const [pedidoRows] = await connection.execute(
        'SELECT usuario_id, total FROM pedidos WHERE id = ?',
        [id]
      );

      if (pedidoRows.length > 0) {
        const pedido = pedidoRows[0];
        await connection.execute(
          'INSERT INTO ventas (pedido_id, usuario_id, total_venta) VALUES (?, ?, ?)',
          [id, pedido.usuario_id, pedido.total]
        );
      }
    }

    await connection.commit();

    res.json({ message: 'Estado del pedido actualizado exitosamente' });

  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  } finally {
    connection.release();
  }
};