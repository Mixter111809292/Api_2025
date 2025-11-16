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
// 📦 OBTENER PRODUCTO POR ID
// =======================================
export const obtenerProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await conmysql.execute(
      'SELECT * FROM productos WHERE id = ?', 
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};

export const subirImagen = async (req, res) => {
  try {
    const archivo = req.file; // Necesitas multer para manejar archivos
    
    const resultado = await cloudinary.uploader.upload(archivo.path, {
      folder: 'productos'
    });

    res.json({
      url: resultado.secure_url,
      public_id: resultado.public_id
    });
  } catch (error) {
    res.status(500).json({ message: 'Error subiendo imagen' });
  }
};


// =======================================
// 🧑‍💼 CREAR PRODUCTO
// =======================================
export const crearProducto = async (req, res) => {
  try {
    if (req.user.rol !== 'administrador') {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const { nombre, descripcion, precio, stock, unidad, categoria } = req.body;

    if (!nombre || !precio || !stock || !unidad) {
      return res.status(400).json({
        message: 'Faltan campos requeridos'
      });
    }

    let imagenUrl = null;

    // Si viene una imagen → subir a Cloudinary
    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'productos_imagenes',
            resource_type: 'auto'
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      imagenUrl = uploadResult.secure_url;
    }

    const [result] = await conmysql.execute(
      `INSERT INTO productos 
      (nombre, descripcion, precio, stock, unidad, categoria, disponible, imagen_url) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre,
        descripcion || null,
        precio,
        stock,
        unidad,
        categoria || null,
        1,
        imagenUrl
      ]
    );

    res.status(201).json({
      message: 'Producto creado correctamente',
      id: result.insertId,
      imagen: imagenUrl
    });

  } catch (error) {
    res.status(500).json({ message: 'Error servidor', error: error.message });
  }
};


// =======================================
// ✏️ ACTUALIZAR PRODUCTO (PUT)
// =======================================
export const actualizarProducto = async (req, res) => {
  try {
    if (req.user.rol !== 'administrador') {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const { id } = req.params;
    let imagenUrl = null;

    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'productos_imagenes', resource_type: 'auto' },
          (error, result) => error ? reject(error) : resolve(result)
        );
        stream.end(req.file.buffer);
      });

      imagenUrl = uploadResult.secure_url;
    }

    const { nombre, descripcion, precio, stock, unidad, categoria, disponible } = req.body;

    const [result] = await conmysql.execute(
      `UPDATE productos 
      SET nombre=?, descripcion=?, precio=?, stock=?, unidad=?, categoria=?, disponible=?, imagen_url=? 
      WHERE id=?`,
      [
        nombre,
        descripcion || null,
        precio,
        stock,
        unidad,
        categoria || null,
        disponible ?? 1,
        imagenUrl,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json({ message: 'Producto actualizado correctamente' });

  } catch (error) {
    res.status(500).json({ message: 'Error servidor', error: error.message });
  }
};


// =======================================
// 🔧 PATCH (actualizar parcialmente)
// =======================================
export const patchProducto = async (req, res) => {
  try {
    if (req.user.rol !== 'administrador') {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const { id } = req.params;

    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'productos_imagenes', resource_type: 'auto' },
          (error, result) => error ? reject(error) : resolve(result)
        );
        stream.end(req.file.buffer);
      });

      req.body.imagen_url = uploadResult.secure_url;
    }

    const keys = Object.keys(req.body);
    const values = Object.values(req.body);

    if (keys.length === 0) {
      return res.status(400).json({ message: 'No hay campos para actualizar' });
    }

    const setQuery = keys.map(k => `${k}=?`).join(', ');

    const [result] = await conmysql.execute(
      `UPDATE productos SET ${setQuery} WHERE id = ?`,
      [...values, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json({ message: 'Actualización parcial exitosa' });

  } catch (error) {
    res.status(500).json({ message: 'Error servidor', error: error.message });
  }
};


// =======================================
// ❌ ELIMINAR PRODUCTO
// =======================================
export const eliminarProducto = async (req, res) => {
  try {
    if (req.user.rol !== 'administrador') {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const { id } = req.params;

    const [result] = await conmysql.execute(
      'DELETE FROM productos WHERE id = ?', 
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json({ message: 'Producto eliminado correctamente' });

  } catch (error) {
    res.status(500).json({ message: 'Error servidor', error: error.message });
  }
};