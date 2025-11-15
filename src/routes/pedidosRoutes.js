import express from 'express';
import { 
  crearPedido, 
  obtenerMisPedidos, 
  obtenerTodosPedidos, 
  actualizarEstadoPedido 
} from '../controladores/pedidosCtrl.js';
import { verifyToken } from '../jwt/verifyToken.js';

const router = express.Router();

// Ciudadanos
router.post('/', verifyToken, crearPedido);
router.get('/mis-pedidos', verifyToken, obtenerMisPedidos);

// Administradores
router.get('/', verifyToken, obtenerTodosPedidos);
router.put('/:id/estado', verifyToken, actualizarEstadoPedido);

export default router;