import express from 'express';
import dashboardController from '../../controllers/dashboard.controller/dashboard.controller';
import {requireAuth} from '../../services/passport';

const router = express.Router();
router.route('/lastUsers').get(requireAuth,dashboardController.getLastUser);

router.route('/count').get(requireAuth,dashboardController.count);
router.route('/sharesCount').get(requireAuth,dashboardController.getSharesCount);
router.route('/graph').get(requireAuth,dashboardController.graph);

export default router;
