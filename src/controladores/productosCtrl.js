import { conmysql } from '../db.js';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

// =======================================
// 🔧 CONFIGURACIÓN DE CLOUDINARY (Igual que animales)
// =======================================
cloudinary.config({
    cloud_name: 'dqxjdfncz',
    api_key: '972776657996249',
    api_secret: '5F2PB9yT5_xycNG_vKyegoOoMc8'
});

// =======================================
// ⚙️ CONFIGURACIÓN DE MULTER (Igual que animales)
// =======================================
const storage = multer.memoryStorage();
const upload = multer({ storage: storage }).array('imagenes[]'); // Mismo nombre que animales
export { upload };

// =======================================
// 📦 OBTENER TODOS LOS PRODUCTOS DISPONIBLES
// =======================================
export const obtenerProductos = async (req, res) => {
  try {
    const [rows] = await conmysql.execute(
      'SELECT * FROM productos WHERE disponible = TRUE ORDER BY nombre'
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
      'SELECT * FROM productos WHERE id = ? AND disponible = TRUE', 
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

// =======================================
// 🧑‍💼 CREAR PRODUCTO (Actualizado como animales)
// =======================================
export const crearProducto = async (req, res) => {
  try {
    if (req.user.rol !== 'administrador') {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const { nombre, descripcion, precio, stock, unidad, categoria, disponible } = req.body;

    if (!nombre || !precio || !stock || !unidad) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }

    let imagenUrl = null;

    // SUBIR IMAGEN A CLOUDINARY
    if (req.files && req.files.length > 0) {
      console.log('Archivos recibidos para producto:', req.files);

      const imagen = req.files[0];

      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'productos_tienda',
            resource_type: 'auto',
          },
          (error, result) => {
            if (error) {
              console.error("Error al subir imagen:", error);
              return reject(error);
            }
            console.log('Imagen de producto subida exitosamente:', result.secure_url);
            resolve(result);
          }
        );
        uploadStream.end(imagen.buffer);
      });

      imagenUrl = uploadResult.secure_url;
    }

    // 🔥 CONVERSIÓN CORRECTA PARA MYSQL
    const disponibleInt =
      disponible === "1" || disponible === 1 || disponible === true || disponible === "true"
        ? 1
        : 0;

    // INSERTAR EN MYSQL
    const [result] = await conmysql.execute(
      `INSERT INTO productos 
      (nombre, descripcion, precio, stock, unidad, categoria, disponible, imagen_url) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre,
        descripcion || null,
        parseFloat(precio),
        parseInt(stock),
        unidad,
        categoria || null,
        disponibleInt,  // 👈 SOLUCIÓN REAL
        imagenUrl
      ]
    );

    res.status(201).json({
      message: 'Producto creado exitosamente',
      id: result.insertId,
      imagen_url: imagenUrl
    });

  } catch (error) {
    console.error('Error en crearProducto:', error);
    res.status(500).json({ message: 'Error al crear producto', error: error.message });
  }
};

// =======================================
// ✏️ ACTUALIZAR PRODUCTO (Actualizado como animales)
// =======================================
export const actualizarProducto = async (req, res) => {
  try {
    if (req.user.rol !== 'administrador') {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const { id } = req.params;
    const { nombre, descripcion, precio, stock, unidad, categoria, disponible } = req.body;

    // Verificar si el producto existe
    const [productoExistente] = await conmysql.execute(
      'SELECT imagen_url FROM productos WHERE id = ?',
      [id]
    );

    if (productoExistente.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    let imagenUrl = productoExistente[0].imagen_url;

    // Si se sube nueva imagen, reemplazar la anterior
    if (req.files && req.files.length > 0) {
      console.log('Actualizando imagen del producto:', req.files);
      
      const imagen = req.files[0];
      
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'productos_tienda',
            resource_type: 'auto',
          },
          (error, result) => {
            if (error) {
              console.error("Error al subir nueva imagen:", error);
              return reject(error);
            }
            console.log('Nueva imagen de producto subida:', result.secure_url);
            resolve(result);
          }
        );
        uploadStream.end(imagen.buffer);
      });

      imagenUrl = uploadResult.secure_url;

      // Opcional: Eliminar la imagen anterior de Cloudinary si existe
      // (esto requiere guardar el public_id en la base de datos)
    }

    // Actualizar producto en la base de datos
    const [result] = await conmysql.execute(
      `UPDATE productos 
      SET nombre = ?, descripcion = ?, precio = ?, stock = ?, unidad = ?, 
          categoria = ?, disponible = ?, imagen_url = ?, fecha_actualizacion = CURRENT_TIMESTAMP 
      WHERE id = ?`,
      [
        nombre,
        descripcion || null,
        parseFloat(precio),
        parseInt(stock),
        unidad,
        categoria || null,
        disponible !== undefined ? disponible : true,
        imagenUrl,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json({ 
      message: 'Producto actualizado exitosamente',
      imagen_url: imagenUrl 
    });

  } catch (error) {
    console.error('Error en actualizarProducto:', error);
    res.status(500).json({ message: 'Error al actualizar producto', error: error.message });
  }
};

// =======================================
// 🔧 ACTUALIZAR STOCK (Nuevo método útil)
// =======================================
export const actualizarStock = async (req, res) => {
  try {
    if (req.user.rol !== 'administrador') {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const { id } = req.params;
    const { stock } = req.body;

    const [result] = await conmysql.execute(
      'UPDATE productos SET stock = ?, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = ?',
      [parseInt(stock), id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json({ message: 'Stock actualizado exitosamente' });

  } catch (error) {
    console.error('Error en actualizarStock:', error);
    res.status(500).json({ message: 'Error al actualizar stock', error: error.message });
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

    // Primero obtener información de la imagen para eliminarla de Cloudinary
    const [producto] = await conmysql.execute(
      'SELECT imagen_url FROM productos WHERE id = ?',
      [id]
    );

    if (producto.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    // Opcional: Eliminar imagen de Cloudinary si existe
    // if (producto[0].imagen_url) {
    //   // Extraer public_id de la URL y eliminar de Cloudinary
    //   // Esto requiere guardar el public_id en la base de datos
    // }

    // Eliminar producto de la base de datos
    const [result] = await conmysql.execute(
      'DELETE FROM productos WHERE id = ?', 
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json({ message: 'Producto eliminado exitosamente' });

  } catch (error) {
    console.error('Error en eliminarProducto:', error);
    res.status(500).json({ message: 'Error al eliminar producto', error: error.message });
  }
};

// =======================================
// 🖼️ SUBIR IMAGENES ADICIONALES (Opcional - como animales)
// =======================================
export const agregarImagenesProducto = async (req, res) => {
  try {
    if (req.user.rol !== 'administrador') {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const { id } = req.params;

    // Verificar si el producto existe
    const [producto] = await conmysql.execute(
      'SELECT id FROM productos WHERE id = ?',
      [id]
    );

    if (producto.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No se han subido imágenes' });
    }

    const imagenesSubidas = [];

    // Subir cada imagen a Cloudinary
    for (const imagen of req.files) {
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'productos_tienda',
            resource_type: 'auto',
          },
          (error, result) => {
            if (error) {
              console.error("Error al subir imagen:", error);
              return reject(error);
            }
            resolve(result);
          }
        );
        uploadStream.end(imagen.buffer);
      });

      console.log('Imagen adicional subida:', uploadResult.secure_url);
      imagenesSubidas.push(uploadResult.secure_url);

      // Si quieres guardar múltiples imágenes, necesitarías una tabla adicional
      // similar a imagenes_animales
    }

    // Por ahora actualizamos la imagen principal con la primera subida
    if (imagenesSubidas.length > 0) {
      await conmysql.execute(
        'UPDATE productos SET imagen_url = ? WHERE id = ?',
        [imagenesSubidas[0], id]
      );
    }

    res.json({ 
      message: 'Imágenes agregadas exitosamente', 
      imagenes: imagenesSubidas 
    });

  } catch (error) {
    console.error('Error en agregarImagenesProducto:', error);
    res.status(500).json({ message: 'Error al agregar imágenes', error: error.message });
  }
};