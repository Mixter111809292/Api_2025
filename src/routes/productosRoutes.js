import express from 'express';
import { obtenerProductos, obtenerProducto, crearProducto, actualizarProducto, eliminarProducto, patchProducto,upload} from '../controladores/productosCtrl.js';
import { verifyToken } from '../jwt/verifyToken.js';

const router = express.Router();

// Público
router.get('/', obtenerProductos);
router.get('/:id', obtenerProducto);

// Solo administradores
router.post('/', verifyToken, upload, crearProducto);
router.put('/:id', verifyToken, upload, actualizarProducto);
router.patch('/:id', verifyToken, upload, patchProducto);
router.delete('/:id', verifyToken, eliminarProducto);

export default router;
