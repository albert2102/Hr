import express from 'express';
const router = express.Router();
import promocodeController from '../../controllers/promocode.controller/promocode.controller';
import { requireAuth } from '../../services/passport';

router.route('/')
      .post(requireAuth, promocodeController.validateBody(),promocodeController.create)
      .get(promocodeController.findAll)

router.post('/confirmPromoCode',requireAuth,promocodeController.validateConfirm(),promocodeController.confirmCode)

router.route('/:id')
      .get(promocodeController.findById)
      .delete(promocodeController.delete)
      .put(promocodeController.validateUpdateBody(),promocodeController.update)


export default router;