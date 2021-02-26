var express = require('express');
var router = express.Router();
import branchesController from "../../controllers/branches.controller/branches.controller";
import {requireAuth} from '../../services/passport';

router.route('/')
    .get(branchesController.findAll)
    .post(requireAuth,branchesController.validateBody(),branchesController.create)


router.route('/:brancheId')
    .get(requireAuth,branchesController.findById)
    .put(requireAuth,branchesController.validateBody(true),branchesController.update)
    .delete(requireAuth,branchesController.delete)

export default router;