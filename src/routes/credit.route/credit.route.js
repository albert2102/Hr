import express from 'express';
import CreditController from '../../controllers/credit.controller/credit.controller';
import { requireAuth } from '../../services/passport';

const router = express.Router();

router.route('/')
        .post(requireAuth,CreditController.validate() , CreditController.create)
        .get(requireAuth,CreditController.findAll)


router.route('/:id').get(requireAuth,CreditController.findById)
        .delete(requireAuth,CreditController.delete)
        .put(requireAuth,CreditController.validate(true) ,CreditController.update);

export default router;
