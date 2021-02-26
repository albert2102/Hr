var express = require('express');
var router = express.Router();
import countryController from "../../controllers/country.controller/country.controller";
import {requireAuth} from '../../services/passport';

router.route('/')
    .get(countryController.findAll)
    .post(requireAuth,countryController.validateBody(),countryController.create)


router.route('/:countryId')
    .get(requireAuth,countryController.findById)
    .put(requireAuth,countryController.validateBody(true),countryController.update)
    .delete(requireAuth,countryController.delete)

export default router;