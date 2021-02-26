import mongoose,{ Schema} from "mongoose";
import autoIncrement from 'mongoose-auto-increment';
import mongooseI18n from 'mongoose-i18n-localize'
const favoritesSchema = new Schema({
    _id: {
        type: Number,
        required: true
    },
    product:{
        type:String,
        ref: 'product',
        required:true
    },
    user:{
        type: Number,
        required: true,
        ref:'user'
    },
    deleted:{
        type:Boolean,
        default:false
    }
}, { timestamps: true });

favoritesSchema.set('toJSON', {
    transform: function (doc, ret, options) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});
autoIncrement.initialize(mongoose.connection);
favoritesSchema.plugin(autoIncrement.plugin, { model: 'favorites', startAt: 1 });
favoritesSchema.plugin(mongooseI18n, {locales: ['en', 'ar']});
export default mongoose.model('favorites', favoritesSchema);