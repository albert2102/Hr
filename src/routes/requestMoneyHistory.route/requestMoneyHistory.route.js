var express = require('express');
var router = express.Router();
import requestMoneyHistoryController from "../../controllers/requestMoneyHistory.controller/requestMoneyHistory.controller";
import {requireAuth} from '../../services/passport';

router.route('/')
    .get(requestMoneyHistoryController.findAll)
    .post(requireAuth,requestMoneyHistoryController.validateBody(),requestMoneyHistoryController.create)

router.route('/:requestMoneyId/payed').post(requireAuth,requestMoneyHistoryController.payedOrders)

router.route('/:requestMoneyId')
    .get(requireAuth,requestMoneyHistoryController.findById)
    .delete(requireAuth,requestMoneyHistoryController.delete)

export default router;