import mongoose,{ Schema} from "mongoose";
import mongooseI18n from "mongoose-i18n-localize";
import autoIncrement from 'mongoose-auto-increment';
const CountrySchema = new Schema({
    _id: {
        type: Number,
        required: true
    },
    name:{
        type:String,
        // required:true,
        i18n: true
    },
    deleted:{
        type:Boolean,
        default:false
    },
    responsible:{
        type:Number,
        ref:'user'
    },
    currency:{
        type:String,
        i18n:true
    },
    deliveryUnit:{
        type:String,
        enum:['KM','MILE']
    },
    deliveryRanges:[{start:Number,end:Number,cost:Number}],
    treatedAs:{
        type:String,
        enum:['EGYPT','AMRICA']
    },
    countryCode:{
        type:String,
        default:'20'
    },
    countryKey:{
        type:String,
        default:'EG'
    },
    logo:{
        type:String
    },
    helpReasons:{
        type:[{ ar: { type: String }, en: { type: String }}]
    },
    driverHelpReasons:{
        type:[{ ar: { type: String }, en: { type: String }}]
    },
    driverPrivacy:{
        type:String,
        i18n:true
    },
    storePrivacy:{
        type:String,
        i18n:true
    },
    driverTermsAndCondition:{
        type:String,
        i18n:true
    },
    storeTermsAndCondition:{
        type:String,
        i18n:true
    }
       
}, { timestamps: true });

CountrySchema.set('toJSON', {
    transform: function (doc, ret, options) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});
autoIncrement.initialize(mongoose.connection);

CountrySchema.plugin(autoIncrement.plugin, { model: 'country', startAt: 1 });
CountrySchema.plugin(mongooseI18n, { locales:['ar','en'] });

export default mongoose.model('country', CountrySchema);