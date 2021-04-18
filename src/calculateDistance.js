/* eslint-disable prettier/prettier */
import request from 'request-promise';
import config from './config';

let duration_time = async(origin, destination) => {

    let data = await request
        .get(
            `https://maps.googleapis.com/maps/api/distancematrix/json?units=metric&origins=${origin.lat},${origin.long}
        &destinations=${destination.lat},${destination.long}&key=${config.GoogleApiKey}&language=ara`,
        )
    if (data) {
        data = JSON.parse(data);
        return data.rows[0].elements[0].duration.value
    }

};
export { duration_time }