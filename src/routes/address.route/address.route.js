var express = require('express');
var router = express.Router();
import addressController from "../../controllers/address.controller/address.controller";
import {requireAuth} from '../../services/passport';

router.route('/')
    .get(addressController.findAll)
    .post(requireAuth,addressController.validateBody(),addressController.create)


router.route('/:addressId')
    .get(requireAuth,addressController.findById)
    .put(requireAuth,addressController.validateBody(true),addressController.update)
    .delete(requireAuth,addressController.delete)

export default router;