import express from 'express';
import { 
  obtenerProductos, 
  obtenerProducto, 
  crearProducto, 
  actualizarProducto, 
  eliminarProducto,
  actualizarStock,
  agregarImagenesProducto
} from '../controladores/productosCtrl.js';
import { verifyToken } from '../jwt/verifyToken.js';
import { upload } from '../controladores/productosCtrl.js'; // Importamos el upload configurado

const router = express.Router();

// Rutas públicas
router.get('/', obtenerProductos);
router.get('/:id', obtenerProducto);

// Rutas protegidas (solo administradores)
router.post('/', verifyToken, upload, crearProducto); // Ahora usa upload
router.put('/:id', verifyToken, upload, actualizarProducto); // Ahora usa upload
router.patch('/:id/stock', verifyToken, actualizarStock);
router.delete('/:id', verifyToken, eliminarProducto);

// Ruta para agregar imágenes adicionales
router.post('/:id/imagenes', verifyToken, upload, agregarImagenesProducto);

export default router;