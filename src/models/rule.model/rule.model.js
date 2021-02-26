import mongoose, { Schema } from 'mongoose';
import autoIncrement from 'mongoose-auto-increment';
import mongooseI18nLocalize from 'mongoose-i18n-localize'

const rulesSchema = new Schema({
    _id:{
        type:Number
    },
    name:{
        type:String,
        required:true,
        i18n:true
    },
    number:{
        type:Number,
        required:true
    },
    properties:{
        type:[String],
        enum:['ADD','UPDATE','SHOW','DELETE','STATUS'],
        required: true
    },
    deleted:{
        type:Boolean,
        default:false
    }
},{timestamps:true})

rulesSchema.set('toJSON',{
    transform: function(doc, ret, options){
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
})
autoIncrement.initialize(mongoose.connection);
rulesSchema.plugin(autoIncrement.plugin,{model:'rule' , startAt:1});
rulesSchema.plugin(mongooseI18nLocalize, {locales:['en','ar']});

export default mongoose.model('rule',rulesSchema);
