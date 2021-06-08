import mongoose, { Schema } from 'mongoose';
import autoIncrement from 'mongoose-auto-increment';
import mongooseI18nLocalize from 'mongoose-i18n-localize'

const requestMoneyHistorysSchema = new Schema({
    _id:{
        type:Number
    },
    driver:{
        type:Number,
    },
    trader:{
        type:Number,
    },
    orders:{
        type:[Number],
        required: true
    },
    payedDate:{
        type: Date
    },
    payedBy:{
        type:Number
    },
    deleted:{
        type:Boolean,
        default:false
    }
},{timestamps:true})

requestMoneyHistorysSchema.set('toJSON',{
    transform: function(doc, ret, options){
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
})
autoIncrement.initialize(mongoose.connection);
requestMoneyHistorysSchema.plugin(autoIncrement.plugin,{model:'requestMoneyHistory' , startAt:1});
requestMoneyHistorysSchema.plugin(mongooseI18nLocalize, {locales:['en','ar']});

export default mongoose.model('requestMoneyHistory',requestMoneyHistorysSchema);
