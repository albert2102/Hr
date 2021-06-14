var express = require('express');
var router = express.Router();
import productCategoryController from "../../controllers/product-category.controller/product-category.controller";
import { requireAuth } from '../../services/passport';
// import { multerSaveTo } from '../../services/multer-service';
// import { parseObject } from '../../controllers/shared.controller/shared.controller';

router.route('/')
    .get(productCategoryController.findAll)
    .post(requireAuth,
        // multerSaveTo('productCategory').single('icon'),
        // parseObject(['name']),
        productCategoryController.validateBody(), productCategoryController.create)

router.route('/deleteMutliple').delete(requireAuth,productCategoryController.validateDeleteMulti(),productCategoryController.deleteMuti)

router.route('/:productCategoryId')
    .get(productCategoryController.findById)
    .put(requireAuth,
        // multerSaveTo('productCategory').single('icon'),
        // parseObject(['name']),
        productCategoryController.validateBody(true),
        productCategoryController.update)
    .delete(requireAuth, productCategoryController.delete)

export default router;