import express from 'express';
import RateController from '../../controllers/rate.controller/rate.controller';
import { requireAuth } from '../../services/passport';

const router = express.Router();

router.route('/driver')
    .post(
        requireAuth,
        RateController.validateDriverBody(),
        RateController.createDriverRate
    )
router.route('/')
    .post(
        requireAuth,
        RateController.validateBody(),
        RateController.create
    )
    .get(RateController.findAll);



router.route('/rate').get(requireAuth, RateController.findUserRate)
router.route('/:rateId')
    .put(
        requireAuth,
        RateController.validateBody(true),
        RateController.update
    )
    .get(RateController.findById)
    .delete(requireAuth, RateController.delete);

export default router;