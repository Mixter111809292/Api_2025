import express from 'express';
import { obtenerReportesVentas } from '../controladores/ventasCtrl.js';
import { verifyToken } from '../jwt/verifyToken.js';

const router = express.Router();

// Solo administradores
router.get('/reportes', verifyToken, obtenerReportesVentas);

export default router;