import axios from 'axios';
import { Registry, RegistryResultItem } from "../registry";

export class GeoNames extends Registry {

    private user:string;

    get name() {
        return 'geonames.org';
    }
    
    constructor(config:any) {
        super(config);
        this.user = config.user;
    }

    async query(key:string) {
        const results:RegistryResultItem[] = [];
        
        const response = await axios.get(`http://api.geonames.org/searchJSON?formatted=true&q=${encodeURIComponent(key)}&maxRows=100&&username=${this.user}&style=full`);
        if (response.status !== 200) {
            return {
                totalItems: 0,
                items: []
            };
        }
        const json:any = response.data;
        json.geonames.forEach((item:any) => {
            const result:RegistryResultItem = {
                register: this._register,
                id: item.geonameId,
                label: item.toponymName,
                details: item.fcodeName,
                link: `https://www.geonames.org/${item.geonameId}`
            };
            results.push(result);
        });
        return {
            totalItems: json.totalResultsCount,
            items: results
        };
    }
}