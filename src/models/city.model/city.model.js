import mongoose,{ Schema} from "mongoose";
import mongooseI18n from "mongoose-i18n-localize";
import autoIncrement from 'mongoose-auto-increment';
const CitySchema = new Schema({
    _id: {
        type: Number,
        required: true
    },
    name:{
        type:String,
        // required:true,
        i18n: true
    },
    country:{
        type: Number,
        required: true,
        ref:'country'
    },
    deleted:{
        type:Boolean,
        default:false
    }
       
}, { timestamps: true });

CitySchema.set('toJSON', {
    transform: function (doc, ret, options) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});
autoIncrement.initialize(mongoose.connection);

CitySchema.plugin(autoIncrement.plugin, { model: 'city', startAt: 1 });
CitySchema.plugin(mongooseI18n, { locales:['ar','en'] });

export default mongoose.model('city', CitySchema);