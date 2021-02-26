import mongoose,{ Schema} from "mongoose";
import mongooseI18n from "mongoose-i18n-localize";
import autoIncrement from 'mongoose-auto-increment';
const addressSchema = new Schema({
    _id: {
        type: Number,
        required: true
    },
    phone:{
        type:String

    },
    detailedAddress:{
        type:String
    },
    country:{
        type: Number,
        ref:'country'
    },
    city:{
        type: Number,
        ref:'city'
    },
    region:{
        type:String,
        //ref: 'region'
    },
    street:{
        type:String

    },
    long: { 
        type: Number
    },
    lat: { 
        type: Number
    },
    address:{
        type: String 
    },

    details:{
        type: String 
    },
    user:{
        type:Number,
        ref:'user'
    },
    deleted:{
        type:Boolean,
        default:false
    }   
}, { timestamps: true });

addressSchema.set('toJSON', {
    transform: function (doc, ret, options) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});
autoIncrement.initialize(mongoose.connection);

addressSchema.plugin(autoIncrement.plugin, { model: 'address', startAt: 1 });
addressSchema.plugin(mongooseI18n, { locales:['ar','en'] });

export default mongoose.model('address', addressSchema);