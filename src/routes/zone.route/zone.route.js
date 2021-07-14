var express = require('express');
var router = express.Router();
import zoneController from "../../controllers/zone.controller/zone.controller";
import {requireAuth} from '../../services/passport';

router.route('/')
    .get(zoneController.findAll)
    .post(requireAuth,
        zoneController.validateBody(),
        zoneController.create)


router.route('/:zoneId')
    .get(zoneController.findById)
    .put(requireAuth,
        zoneController.validateBody(true),
        zoneController.update)
    .delete(requireAuth,zoneController.delete)

export default router;