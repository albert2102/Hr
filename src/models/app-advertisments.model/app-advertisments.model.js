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
advertismentsSchema.plugin(autoIncrement.plugin, { model: 'appadvertisments', startAt: 1 });
export default mongoose.model('appadvertisments', advertismentsSchema);