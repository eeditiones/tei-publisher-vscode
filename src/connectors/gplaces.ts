import axios from 'axios';
import { Registry, RegistryResultItem } from "../registry";

export class GooglePlaces extends Registry {

    private apiKey:string;

    constructor(config:any) {
        super(config);
        this.apiKey = config.token;
    }

    async query(key:string) {
        const results:RegistryResultItem[] = [];
        
        const response = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(key)}&key=${this.apiKey}`);
        if (response.status !== 200) {
            return {
                totalItems: 0,
                items: []
            };
        }
        const json:any = response.data;
        json.results.forEach((item:any) => {
            const result:RegistryResultItem = {
                register: this._register,
                id: item['place_id'],
                label: item.formatted_address,
                link: `https://www.google.com/maps/place/${item.geometry.location.lat},${item.geometry.location.lng}`
            };
            results.push(result);
        });
        return {
            totalItems: json.results.length,
            items: results
        };
    }
}