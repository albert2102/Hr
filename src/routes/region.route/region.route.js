var express = require('express');
var router = express.Router();
import regionController from "../../controllers/region.controller/region.controller";
import {requireAuth} from '../../services/passport';

router.route('/')
    .get(regionController.findAll)
    .post(requireAuth,regionController.validateBody(),regionController.create)


router.route('/:regionId')
    .get(requireAuth,regionController.findById)
    .put(requireAuth,regionController.validateBody(true),regionController.update)
    .delete(requireAuth,regionController.delete)

export default router;