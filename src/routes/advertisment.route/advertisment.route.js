import express from 'express';
import advertismentController from '../../controllers/advertisments.controller/advertisments.controller';
import {requireAuth } from '../../services/passport';
import { multerSaveTo } from '../../services/multer-service';
import {parseObject} from '../../controllers/shared.controller/shared.controller';
const router = express.Router();

router.route('/republish')
    .post(requireAuth,advertismentController.validateRepublish(),advertismentController.republish)
    
router.route('/')
    .post(requireAuth,
        multerSaveTo('advertisment').array('images'),
        parseObject(['contactBy']),
        advertismentController.validateBody(),
        advertismentController.create)
    .get(advertismentController.find);

router.route('/stop').put(requireAuth,advertismentController.validateStopAdvertisment(),advertismentController.stopAdvertisment)
router.route('/:AdvertismentsId/changeStatus').put(requireAuth,advertismentController.validateAdminChangeStatus(),advertismentController.changeStatus)
router.route('/:AdvertismentsId/increaseViews').put(advertismentController.updateNumberOfViews)

router.route('/:AdvertismentsId')
    .put(requireAuth,
        multerSaveTo('advertisment').array('images'),
        parseObject(['contactBy']),
        advertismentController.validateBody(true),
        advertismentController.update)
    .delete(requireAuth,advertismentController.delete)
    .get(advertismentController.findById)

    
export default router;