import mongoose, { Schema } from "mongoose";
import autoIncrement from 'mongoose-auto-increment';

const advertismentsSchema = new Schema({
    _id: {
        type: Number,
        required: true
    },
    image:{
        type:String
    },
    numberOfSlots:{
        type:Number,
        max:4,
        min:1,
        default:2
    },
    type:{
        type:String,
        enum:['HOME_PAGE','PRODUCT_PAGE'],
        default:'HOME_PAGE'
    },
    homeAddsAfetr:{
        type:String,
        enum:['PRODUCT','CATEGORY'],
        default:'PRODUCT'
    },
    deleted: {
        type: Boolean,
        default: false
    },
}, { timestamps: true });

advertismentsSchema.set('toJSON', {
    transform: function (doc, ret, options) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});
autoIncrement.initialize(mongoose.connection);
advertismentsSchema.plugin(autoIncrement.plugin, { model: 'advertisments', startAt: 1 });
export default mongoose.model('advertisments', advertismentsSchema);