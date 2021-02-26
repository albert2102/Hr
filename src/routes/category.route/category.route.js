var express = require('express');
var router = express.Router();
import categoryController from "../../controllers/category.controller/category.controller";
import { requireAuth } from '../../services/passport';
import { multerSaveTo } from '../../services/multer-service';
import { parseObject } from '../../controllers/shared.controller/shared.controller';

router.route('/specificType').post(requireAuth,
    multerSaveTo('category').fields([{ name: 'image', maxCount: 1 }, { name: 'slider', maxCount: 5 }]),
    parseObject(['name']),
    categoryController.validateToSpecificType(), categoryController.createToSpecificType
)

router.route('/')
    .get(categoryController.findAll)
    .post(requireAuth,
        multerSaveTo('category').fields([{ name: 'image', maxCount: 1 }, { name: 'slider', maxCount: 5 }]),
        parseObject(['name']),
        categoryController.validateBody(), categoryController.create)


router.route('/:categoryId')
    .get(categoryController.findById)
    .put(requireAuth,
        multerSaveTo('category').fields([{ name: 'image', maxCount: 1 }, { name: 'slider', maxCount: 5 }, { name: 'newImages', maxCount: 5 }]),
        parseObject(['name','deletedImages']),
        categoryController.validateBody(true),
        categoryController.update)
    .delete(requireAuth, categoryController.delete)

export default router;