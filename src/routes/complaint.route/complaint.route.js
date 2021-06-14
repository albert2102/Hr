var express = require('express');
var router = express.Router();
import complaintController from "../../controllers/complaint.controller/complaint.controller";
import {requireAuth} from '../../services/passport';

router.route('/')
    .get(requireAuth,complaintController.findAll)
    .post(requireAuth,complaintController.validateBody(),complaintController.create)


router.route('/deleteMutliple').delete(requireAuth,complaintController.validateDeleteMulti(),complaintController.deleteMuti)
router.route('/visitor').post(complaintController.validateVisitor(),complaintController.createVisitorComplain)

router.route('/:id/changeStatus').put(requireAuth,complaintController.validateChangeStatus(),complaintController.changeStatus)
router.route('/:id')
    .get(requireAuth,complaintController.findById)
    .put(requireAuth,complaintController.validateBody(true),complaintController.update)
    .delete(requireAuth,complaintController.delete)

export default router;