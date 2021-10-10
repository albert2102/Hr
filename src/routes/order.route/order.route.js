var express = require('express');
var router = express.Router();
import orderController from "../../controllers/order.controller/order.controller";
import { requireAuth } from '../../services/passport';
import { multerSaveTo } from '../../services/multer-service';


router.route('/:orderId/notifyTrader').post(requireAuth,orderController.notifyTrader)
router.route('/:orderId/notifyClient').post(requireAuth,orderController.notifyClient)

///////////////////////////////////////////////////////////////////////////////////////////////////////
router.route('/traderSales').get(requireAuth, orderController.traderGetSales)
router.route('/driverSales').get(requireAuth, orderController.driverGetSales)

///////////////////////////////////////////////////////////////////////////////////////////////////////


router.route('/deleteMutliple').delete(requireAuth,orderController.validateDeleteMulti(),orderController.deleteMuti)


router.route('/resendOrder')
    .post(requireAuth, orderController.validateResendOrderToTrader(), orderController.resendOrderToTrader)
    
router.route('/resendOrderToDriver')
    .post(requireAuth, orderController.validateResendOrderToDriver(), orderController.resendOrderToDriver)
//////////////////////////////////////////Rate/////////////////////////////////////////////////////////
router.route('/traderRate')
    .get(/*requireAuth,*/ orderController.getRates)
    .post(requireAuth, orderController.validateTraderRate(), orderController.traderRate)

///////////////////////////////////////////////////////////////////////////////////////////////////////
router.route('/')
    .get(requireAuth, orderController.findAll)
    .post(requireAuth,
        orderController.validateBody(),
        orderController.create)


router.route('/:orderId/accepteOrReject').put(requireAuth, orderController.validateAcceptOrReject(), orderController.acceptOrReject)
router.route('/:orderId/driverAccepteOrReject').put(requireAuth, orderController.validateDriverAcceptOrReject(), orderController.driverAcceptOrReject)
router.route('/:orderId/driverShipped').put(requireAuth, orderController.driverShipped)
router.route('/:orderId/shipped').put(requireAuth, orderController.shipped)
router.route('/:orderId/prepared').put(requireAuth, orderController.prepared)
router.route('/:orderId/delivered').put(requireAuth, orderController.delivered)
router.route('/:orderId/canceled').put(requireAuth, orderController.canceled)

router.route('/:orderId')
    .get(requireAuth, orderController.findById)
    .delete(requireAuth, orderController.delete)


export default router;