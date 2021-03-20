var express = require('express');
var router = express.Router();
import favoritesController from "../../controllers/favorites.controller/favorites.controller";
import {requireAuth} from '../../services/passport';

router.route('/')
    .get(favoritesController.findAll)
    .post(requireAuth,favoritesController.validateBody(),favoritesController.create)
    .delete(requireAuth,favoritesController.delete)

router.route('/:favoriteId')
    .get(requireAuth,favoritesController.findById)
    .put(requireAuth,favoritesController.validateBody(true),favoritesController.update)
    

export default router;