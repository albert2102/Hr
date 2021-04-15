import mongoose,{ Schema} from "mongoose";
import mongooseI18n from "mongoose-i18n-localize";
import autoIncrement from 'mongoose-auto-increment';
const shippingCardSchema = new Schema({
    _id: {
        type: Number,
        required: true
    },
    price:{
        type:Number

    },
    value:{
        type:Number
    },
    number:{
        type:String
    },
    used:{
        type:Boolean,
        default:false
    },
    user:{
        type:Number
    },
    deleted:{
        type:Boolean,
        default:false
    }   
}, { timestamps: true });

shippingCardSchema.set('toJSON', {
    transform: function (doc, ret, options) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});
autoIncrement.initialize(mongoose.connection);

shippingCardSchema.plugin(autoIncrement.plugin, { model: 'shippingCard', startAt: 1 });
shippingCardSchema.plugin(mongooseI18n, { locales:['ar','en'] });

export default mongoose.model('shippingCard', shippingCardSchema);