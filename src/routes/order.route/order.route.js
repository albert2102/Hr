var express = require('express');
var router = express.Router();
import orderController from "../../controllers/order.controller/order.controller";
import { requireAuth } from '../../services/passport';
import { multerSaveTo } from '../../services/multer-service';

///////////////////////////////////////////////////////////////////////////////////////////////////////
router.route('/traderSales').get(requireAuth, orderController.traderGetSales)

///////////////////////////////////////////////////////////////////////////////////////////////////////

router.route('/resendOrder')
    .post(requireAuth, orderController.validateResendOrderToTrader(), orderController.resendOrderToTrader)
    
//////////////////////////////////////////Rate/////////////////////////////////////////////////////////
router.route('/traderRate')
    .get(requireAuth, orderController.getRates)
    .post(requireAuth, orderController.validateTraderRate(), orderController.traderRate)

///////////////////////////////////////////////////////////////////////////////////////////////////////
router.route('/')
    .get(requireAuth, orderController.findAll)
    .post(requireAuth,
        orderController.validateBody(),
        orderController.create)


router.route('/:orderId/accepteOrReject').put(requireAuth, orderController.validateAcceptOrReject(), orderController.acceptOrReject)
router.route('/:orderId/driverAccepteOrReject').put(requireAuth, orderController.validateDriverAcceptOrReject(), orderController.driverAcceptOrReject)
router.route('/:orderId/shipped').put(requireAuth, orderController.shipped)
router.route('/:orderId/delivered').put(requireAuth, orderController.delivered)
router.route('/:orderId/canceled').put(requireAuth, orderController.canceled)

router.route('/:orderId')
    .get(requireAuth, orderController.findById)
    .delete(requireAuth, orderController.delete)


export default router;