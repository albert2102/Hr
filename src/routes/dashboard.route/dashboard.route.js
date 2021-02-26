import express from 'express';
import dashboardController from '../../controllers/dashboard.controller/dashboard.controller';
import {requireAuth} from '../../services/passport';

const router = express.Router();
router.route('/lastUsers').get(requireAuth,dashboardController.getLastUser);
router.route('/lastOrders').get(requireAuth,dashboardController.getLastOrders);
router.route('/topOrders').get(requireAuth,dashboardController.topOrders);
router.route('/topSellingProduct').get(requireAuth,dashboardController.topSellingProduct);

router.route('/count').get(requireAuth,dashboardController.count);
router.route('/sharesCount').get(requireAuth,dashboardController.getSharesCount);
router.route('/graph').get(requireAuth,dashboardController.graph);

export default router;
