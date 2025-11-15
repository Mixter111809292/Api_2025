import { conmysql } from '../db.js';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

// =======================================
// 🔧 CONFIGURACIÓN DE CLOUDINARY
// =======================================
cloudinary.config({
  cloud_name: 'dqxjdfncz',          // Reemplaza con tu Cloud Name
  api_key: '972776657996249',       // Reemplaza con tu API Key
  api_secret: '5F2PB9yT5_xycNG_vKyegoOoMc8'  // Reemplaza con tu API Secret
});

// =======================================
// ⚙️ CONFIGURACIÓN DE MULTER (para imágenes)
// =======================================
const storage = multer.memoryStorage();
export const upload = multer({ storage }).single('imagen'); // campo 'imagen' en el formulario

// =======================================
// 📦 OBTENER TODOS LOS PRODUCTOS DISPONIBLES
// =======================================
export const obtenerProductos = async (req, res) => {
  try {
    const [rows] = await conmysql.execute(
      'SELECT * FROM productos ORDER BY nombre'
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};


// =======================================
// 📦 OBTENER UN PRODUCTO POR ID
// =======================================
export const obtenerProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await conmysql.execute('SELECT * FROM productos WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    const producto = rows[0];
    if (!producto.disponible) {
      return res.status(200).json({ message: `Producto con ID ${id} no disponible`, producto });
    }

    res.json(producto);
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};



// =======================================
// 🧑‍💼 CREAR PRODUCTO (solo administrador)
// =======================================
export const crearProducto = async (req, res) => {
  try {
    // ✅ Solo administradores pueden crear productos
    if (req.user.rol !== 'administrador') {
      return res.status(403).json({ 
        message: 'No autorizado: solo administradores pueden agregar productos' 
      });
    }

    const { nombre, descripcion, precio, stock, unidad, categoria } = req.body;

    // ✅ Validar campos requeridos
    if (!nombre || !precio || !stock || !unidad) {
      return res.status(400).json({
        message: 'Faltan campos requeridos: nombre, precio, stock, unidad'
      });
    }

    // ✅ Subir imagen a Cloudinary (si se envía)
    let imagenUrl = null;
    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'productos_imagenes',
            resource_type: 'auto',
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });

      imagenUrl = uploadResult.secure_url;
    }

    // ✅ Definir valores seguros
    const descripcionSafe = descripcion || null;
    const categoriaSafe = categoria || null;
    const disponibleSafe = 1; // 🔥 Siempre se guarda como disponible (TRUE)

    // ✅ Insertar producto en la base de datos
    const [result] = await conmysql.execute(
      `INSERT INTO productos 
      (nombre, descripcion, precio, stock, unidad, categoria, disponible, imagen_url) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, descripcionSafe, precio, stock, unidad, categoriaSafe, disponibleSafe, imagenUrl ?? null]
    );

    // ✅ Respuesta
    res.status(201).json({
      message: 'Producto creado exitosamente',
      id: result.insertId,
      imagen: imagenUrl,
      disponible: disponibleSafe
    });

  } catch (error) {
    console.error('Error al crear producto:', error);
    res.status(500).json({ 
      message: 'Error del servidor', 
      error: error.message 
    });
  }
};


// =======================================
// 🧾 ACTUALIZAR PRODUCTO COMPLETO (solo admin)
// =======================================
export const actualizarProducto = async (req, res) => {
  try {
    if (req.user.rol !== 'administrador') {
      return res.status(403).json({ message: 'No autorizado: solo administradores pueden actualizar productos' });
    }

    const { id } = req.params;
    const { nombre, descripcion, precio, stock, unidad, categoria, disponible } = req.body;

    let imagenUrl = null;
    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: 'productos_imagenes', resource_type: 'auto' },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });
      imagenUrl = uploadResult.secure_url;
    }

    const descripcionSafe = descripcion || null;
    const categoriaSafe = categoria || null;
    const disponibleSafe = disponible !== undefined ? disponible : true;

    const [result] = await conmysql.execute(
      'UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, stock = ?, unidad = ?, categoria = ?, disponible = ?, imagen_url = ? WHERE id = ?',
      [
        nombre,
        descripcionSafe,
        precio,
        stock,
        unidad,
        categoriaSafe,
        disponibleSafe,
        imagenUrl ?? null,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json({ message: 'Producto actualizado exitosamente' });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};

// =======================================
// ✏️ PATCH - ACTUALIZAR PARCIALMENTE (solo admin)
// =======================================
export const patchProducto = async (req, res) => {
  try {
    if (req.user.rol !== 'administrador') {
      return res.status(403).json({ message: 'No autorizado: solo administradores pueden modificar productos' });
    }

    const { id } = req.params;
    const campos = req.body;

    // Subir nueva imagen si viene en la petición
    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: 'productos_imagenes', resource_type: 'auto' },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });
      campos.imagen_url = uploadResult.secure_url;
    }

    // Generar query dinámica
    const keys = Object.keys(campos);
    if (keys.length === 0) {
      return res.status(400).json({ message: 'No se enviaron campos para actualizar' });
    }

    const values = Object.values(campos);
    const setQuery = keys.map(key => `${key} = ?`).join(', ');

    const [result] = await conmysql.execute(
      `UPDATE productos SET ${setQuery} WHERE id = ?`,
      [...values, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json({ message: 'Producto actualizado parcialmente', cambios: campos });
  } catch (error) {
    console.error('Error en PATCH producto:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};

// =======================================
// ❌ ELIMINAR PRODUCTO (solo admin)
// =======================================
export const eliminarProducto = async (req, res) => {
  try {
    if (req.user.rol !== 'administrador') {
      return res.status(403).json({ message: 'No autorizado: solo administradores pueden eliminar productos' });
    }

    const { id } = req.params;
    const [result] = await conmysql.execute('DELETE FROM productos WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json({ message: 'Producto eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};
