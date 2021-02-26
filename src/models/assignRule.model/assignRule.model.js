import mongoose, { Schema } from 'mongoose';
import autoIncrement from 'mongoose-auto-increment';

const assignRuleSchema = new Schema({
    _id:{
        type:Number
    },
    rule:{
        type:Number,
        ref:'rule',
        required:true
    },
    user:{
        type:Number,
        ref:'user',
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

assignRuleSchema.set('toJSON',{
    transform: function(doc, ret, options){
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
})
autoIncrement.initialize(mongoose.connection);
assignRuleSchema.plugin(autoIncrement.plugin,{model:'assignRule' , startAt:1});

export default mongoose.model('assignRule',assignRuleSchema);
