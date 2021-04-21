import express from 'express';
import CompanyController from '../../controllers/company.controller/company.controller';
import { requireAuth } from '../../services/passport';
import { multerSaveTo } from '../../services/multer-service';
import { parseObject } from '../../controllers/shared.controller/shared.controller'
const router = express.Router();

let parseArray = ['commissionAgreement','socialLinks','instructionsForUse','location','fixedCategoryName','contactusReasons'];

const uploadedFiles =[
    {name:"logo",maxCount:1},
    {name:"fixedCategoryIcon",maxCount:1},
]
        
router.route('/')
    .post(
        multerSaveTo('company').fields(uploadedFiles),
        parseObject(parseArray),
        CompanyController.validateBody(),
        CompanyController.create
    )
    .get(CompanyController.findAll);

router.route('/share').post(CompanyController.share);

router.route('/:companyId')
    .put(
        multerSaveTo('company').fields(uploadedFiles),
        parseObject(parseArray),
        CompanyController.validateBody(true),
        CompanyController.update
    )
    .get(CompanyController.findById)
    .delete(requireAuth,CompanyController.delete);
  

export default router;
