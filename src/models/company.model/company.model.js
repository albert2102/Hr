import mongoose,{ Schema} from "mongoose";
import autoIncrement from 'mongoose-auto-increment';
import mongooseI18nLocalize from 'mongoose-i18n-localize';

let locationSchema = new Schema({ 
    long: { type: Number, required: true},
    lat: { type: Number, required: true },
    address:{type:String,required:true,default:"el-Giza"}
});

let CategorySchema = new Schema({ 
    name: { type: String, i18n: true},
    icon: { type: String },
    image: { type: String },
    category: { type: Number, ref: 'category' },
    product: { type: Boolean, default:false },
});

const CompanySchema = new Schema({
    _id: { 
        type: Number,
        required: true
    },
    logo:{
        type:String
    },
    deleted:{
        type:Boolean,
        default:false
    },
    instructionsForUse: {
        type: [
            { title: { ar: { type: String }, en: { type: String } } ,
             description: { ar: { type: String }, en: { type: String } } }
        ],
        i18n: true,
        required: true
    },
    instructionsForUseForDriver: {
        type: [
            { title: { ar: { type: String }, en: { type: String } } ,
             description: { ar: { type: String }, en: { type: String } } }
        ],
        i18n: true,
        required: true
    },
    instructionsForUseForTrader: {
        type: [
            { title: { ar: { type: String }, en: { type: String } } ,
             description: { ar: { type: String }, en: { type: String } } }
        ],
        i18n: true,
        required: true
    },
    commissionAgreement:{ //اتفاقية العمولة
        type:[{ ar: { type: String }, en: { type: String }}],
    },
    quranicVerse:{ //الآية القرآنية في اتفاقية العمولة
        type: String
    },
    commissionRatio:{ // %
        type: Number,
        default: 1
    },
    commissionDays:{ // days
        type: Number,
        default: 10
    },
    contactusReasons:{
        type:[{ ar: { type: String }, en: { type: String }}]
    },
    androidUrl:{
        type: String,
        required: true
    },
    iosUrl:{
        type: String,
        required: true
    },
    socialLinks:{
        type: [{key:{type:String } , value:{type:String}}],
        required: true
    },
    location:{
        type: locationSchema,
        // required: true
    },
    appShareCount:{
        type: Number,
        default:0
    },
    traderWaitingTime:{ //in millisecond
        type: Number,
        default: 180000
    },
    driverWaitingTime:{ //in millisecond
        type: Number,
        default: 3600000
    },
    fixedCategoryName:{
        type: String,
        i18n: true
    },
    fixedCategoryIcon:{
        type: String
    },
    allowFixedCategory:{
        type: Boolean,
        default: true
    },
    transportPrice:{
        type: Number,
        default: 0
    },
    numberOfRowsForAdvertisments :{
        type:Number,
        default:2
    },
    taxes:{
        type: Number,
        default: 10
    },
    driver_androidUrl:{
        type: String,
    },
    driver_iosUrl:{
        type: String,
    },
    store_androidUrl:{
        type: String,
    },
    store_iosUrl:{
        type: String,
    },
    driverDuesToStop:{
        type: Number,
        default: -500
    }
    ////////////////////////////////////////////////
    
}, { timestamps: true });

CompanySchema.set('toJSON', {
    transform: function (doc, ret, options) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});
autoIncrement.initialize(mongoose.connection);

CompanySchema.plugin(autoIncrement.plugin, { model: 'company', startAt: 1 });
CompanySchema.plugin(mongooseI18nLocalize,{locales:['ar','en']});

export default mongoose.model('company', CompanySchema);