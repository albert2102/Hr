import mongoose, { Schema } from "mongoose";
import mongooseI18n from 'mongoose-i18n-localize'
import autoIncrement from 'mongoose-auto-increment';
const productCategorySchema = new Schema({
    _id: {
        type: Number,
        required: true
    },
    name: {
        type: String,
        i18n: true
    },
    icon:{
        type: String
    },
    user:{
        type:Number,
        ref:'user'
    },
    deleted: {
        type: Boolean,
        default: false
    },
}, { timestamps: true });

productCategorySchema.set('toJSON', {
    transform: function (doc, ret, options) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});
autoIncrement.initialize(mongoose.connection);
productCategorySchema.plugin(mongooseI18n, {locales: ['en', 'ar']});
productCategorySchema.plugin(autoIncrement.plugin, { model: 'productCategory', startAt: 1 });

export default mongoose.model('productCategory', productCategorySchema);