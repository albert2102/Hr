var express = require('express');
var router = express.Router();
import productController from "../../controllers/product.controller/product.controller";
import { requireAuth } from '../../services/passport';
import { multerSaveTo } from "../../services/multer-service";
import { parseObject } from "../../controllers/shared.controller/shared.controller";

let parseArray = ['name', 'description', 'deletedImages']


router.route('/')
    .get(productController.findAll)
    .post(requireAuth, multerSaveTo('product').fields([{ name: 'image', maxCount: 1 }, { name: 'slider', maxCount: 5 }]), parseObject(parseArray), productController.validateBody(), productController.create)


router.post('/uploadImage', requireAuth, multerSaveTo('product').single('image'), productController.uploadImage)


router.route('/:productId')
    .get(productController.findById)
    .put(requireAuth, multerSaveTo('product').fields([{ name: 'image', maxCount: 1 }, { name: 'slider', maxCount: 5 },{name:'newImages',maxCount:5}]), parseObject(parseArray), productController.validateBody(true), productController.update)
    .delete(requireAuth, productController.delete)

export default router;