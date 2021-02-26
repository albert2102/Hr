var express = require('express');
var router = express.Router();
import cityController from "../../controllers/city.controller/city.controller";
import {requireAuth} from '../../services/passport';

router.route('/')
    .get(cityController.findAll)
    .post(requireAuth,cityController.validateBody(),cityController.create)


router.route('/:cityId')
    .get(requireAuth,cityController.findById)
    .put(requireAuth,cityController.validateBody(true),cityController.update)
    .delete(requireAuth,cityController.delete)

export default router;