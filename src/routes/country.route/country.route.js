var express = require('express');
var router = express.Router();

import countryController from "../../controllers/country.controller/country.controller";
import { parseObject } from "../../controllers/shared.controller/shared.controller";
import { multerSaveTo } from "../../services/multer-service";
import {requireAuth} from '../../services/passport';


let parseArray = ['name','currency' , 'deliveryRanges','helpReasons','driverHelpReasons','driverPrivacy','storePrivacy', 'storeTermsAndCondition','driverTermsAndCondition']

router.route('/')
    .get(countryController.findAll)
    .post(requireAuth , multerSaveTo('country').single('logo'),parseObject(parseArray) ,countryController.validateBody(),countryController.create)


router.route('/:countryId')
    .get(requireAuth,countryController.findById)
    .put(requireAuth, multerSaveTo('country').single('logo'),parseObject(parseArray),countryController.validateBody(true),countryController.update)
    .delete(requireAuth,countryController.delete)

export default router;