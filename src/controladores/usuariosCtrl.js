import { conmysql } from '../db.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';

// =======================================
// 🔧 CONFIGURACIÓN DE CLOUDINARY
// =======================================
cloudinary.config({
  cloud_name: 'dqxjdfncz',
  api_key: '972776657996249',
  api_secret: '5F2PB9yT5_xycNG_vKyegoOoMc8'
});

// =======================================
// ⚙️ MULTER para manejo de imagen de perfil
// =======================================
const storage = multer.memoryStorage();
export const upload = multer({ storage }).single('imagen');

// =======================================
// 🧾 REGISTRAR USUARIO
// =======================================
export const registrarUsuario = async (req, res) => {
  try {
    const { email, contraseña, rol, nombre, telefono, direccion } = req.body;

    if (!email || !contraseña || !rol || !nombre) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }

    const saltRounds = 10;
    const contraseñaEncriptada = await bcrypt.hash(contraseña, saltRounds);

    const [result] = await conmysql.execute(
      'INSERT INTO usuarios (email, contraseña, rol, nombre, telefono, direccion) VALUES (?, ?, ?, ?, ?, ?)',
      [email, contraseñaEncriptada, rol, nombre, telefono, direccion]
    );

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      id: result.insertId
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'El email ya está registrado' });
    }
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};

// =======================================
// 🔐 LOGIN
// =======================================
export const loginUsuario = async (req, res) => {
  try {
    const { email, contraseña } = req.body;

    if (!email || !contraseña) {
      return res.status(400).json({ message: 'Email y contraseña son requeridos' });
    }

    const [rows] = await conmysql.execute(
      'SELECT id, email, contraseña, rol, nombre, telefono, direccion FROM usuarios WHERE email = ? AND activo = TRUE',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const usuario = rows[0];
    const contraseñaValida = await bcrypt.compare(contraseña, usuario.contraseña);
    if (!contraseñaValida) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, rol: usuario.rol },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const { contraseña: _, ...usuarioSinPassword } = usuario;

    res.json({
      message: 'Login exitoso',
      token,
      usuario: usuarioSinPassword
    });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};

// =======================================
// 👤 PERFIL DE USUARIO AUTENTICADO
// =======================================
export const getPerfil = async (req, res) => {
  try {
    const [rows] = await conmysql.execute(
      'SELECT id, email, rol, nombre, telefono, direccion, fecha_creacion FROM usuarios WHERE id = ?',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};

// =======================================
// ✏️ PATCH - ACTUALIZAR PARCIALMENTE USUARIO
// =======================================
export const patchUsuario = async (req, res) => {
  try {
    const userId = req.user.id;
    const campos = req.body;

    // Si quiere cambiar la contraseña
    if (campos.contraseña) {
      const saltRounds = 10;
      campos.contraseña = await bcrypt.hash(campos.contraseña, saltRounds);
    }

    // Si sube nueva imagen de perfil
    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: 'usuarios_perfiles', resource_type: 'auto' },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });
      campos.foto_perfil = uploadResult.secure_url;
    }

    // No permitir cambiar rol ni email por seguridad
    delete campos.rol;
    delete campos.email;

    // Validar que haya algo para actualizar
    const keys = Object.keys(campos);
    if (keys.length === 0) {
      return res.status(400).json({ message: 'No se enviaron campos para actualizar' });
    }

    const values = Object.values(campos);
    const setQuery = keys.map(key => `${key} = ?`).join(', ');

    const [result] = await conmysql.execute(
      `UPDATE usuarios SET ${setQuery} WHERE id = ?`,
      [...values, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({ message: 'Usuario actualizado correctamente', cambios: campos });
  } catch (error) {
    console.error('Error en patchUsuario:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }

  
};


export const actualizarPerfil = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { nombre, telefono, direccion, email } = req.body;

    // Validar que el usuario existe
    const [usuarioRows] = await conmysql.execute(
      'SELECT id FROM usuarios WHERE id = ?',
      [usuarioId]
    );

    if (usuarioRows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Actualizar datos del usuario
    const [result] = await conmysql.execute(
      'UPDATE usuarios SET nombre = ?, telefono = ?, direccion = ?, email = ? WHERE id = ?',
      [nombre, telefono, direccion, email, usuarioId]
    );

    // Obtener usuario actualizado
    const [updatedRows] = await conmysql.execute(
      'SELECT id, email, rol, nombre, telefono, direccion, fecha_creacion FROM usuarios WHERE id = ?',
      [usuarioId]
    );

    res.json({ 
      message: 'Perfil actualizado exitosamente',
      usuario: updatedRows[0]
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'El email ya está en uso' });
    }
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};
