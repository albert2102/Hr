import mongoose,{ Schema} from "mongoose";
import mongooseI18n from "mongoose-i18n-localize";
import autoIncrement from 'mongoose-auto-increment';
const branchSchema = new Schema({
    _id: {
        type: Number,
        required: true
    },
    long: {
        type: Number
    },
    lat: { 
        type: Number
    },
    address:{
        type: String ,
        required:true
    },
    name:{
        type: String,
        i18n:true
    },
    phone:{
        type:String
    },
    deleted:{
        type:Boolean,
        default:false
    }
}, { timestamps: true });

branchSchema.set('toJSON', {
    transform: function (doc, ret, options) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});
autoIncrement.initialize(mongoose.connection);

branchSchema.plugin(autoIncrement.plugin, { model: 'branch', startAt: 1 });
branchSchema.plugin(mongooseI18n, { locales:['ar','en'] });

export default mongoose.model('branch', branchSchema);