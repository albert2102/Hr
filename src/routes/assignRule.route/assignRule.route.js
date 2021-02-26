var express = require('express');
var router = express.Router();
import assignRuleController from "../../controllers/assignRule.controller/assignRule.controller";
import {requireAuth} from '../../services/passport';

router.route('/')
    .get(requireAuth,assignRuleController.findAll)
    .post(requireAuth,assignRuleController.validateBody(),assignRuleController.create)


router.route('/:assignRuleId')
    .get(requireAuth,assignRuleController.findById)
    .put(requireAuth,assignRuleController.validateBody(true),assignRuleController.update)
    .delete(requireAuth,assignRuleController.delete)

export default router;