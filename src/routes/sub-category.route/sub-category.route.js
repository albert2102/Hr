var express = require('express');
var router = express.Router();
import subcategoryController from "../../controllers/sub-category.controller/sub-category.controller";
import {requireAuth} from '../../services/passport';
import {multerSaveTo} from '../../services/multer-service';
import {parseObject} from '../../controllers/shared.controller/shared.controller';

router.route('/')
    .get(subcategoryController.findAll)
    .post(requireAuth,
        multerSaveTo('category').single('image'),
        parseObject(['name']),
        subcategoryController.validateBody(),
        subcategoryController.create)


router.route('/:subcategoryId')
    .get(subcategoryController.findById)
    .put(requireAuth,
        multerSaveTo('category').single('image'),
        parseObject(['name']),
        subcategoryController.validateBody(true),
        subcategoryController.update)
    .delete(requireAuth,subcategoryController.delete)

export default router;