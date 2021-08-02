var express = require('express');
var router = express.Router();
import paymentController from "../../controllers/payment.controller/payment.controller"
import { requireAuth } from '../../services/passport';


router.route('/checkoutId')
    .post(requireAuth, paymentController.validateGetCheckoutId(), paymentController.getCreditCheckoutId)

router.route('/wallet-status')
    .post(requireAuth, paymentController.validateGetPaymentStatus(), paymentController.getWalletPaymentStatus)

router.route('/status')
    .post(requireAuth, paymentController.validateGetPaymentStatus(), paymentController.getPaymentStatus)

router.route('/notify').get(paymentController.notification);

router.route('/refund-credit').post(requireAuth, paymentController.validateRefund(), paymentController.refundCreditPayment)

export default router;