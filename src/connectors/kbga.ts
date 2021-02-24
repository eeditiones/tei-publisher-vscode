import axios from 'axios';
import { Registry, RegistryResultItem } from "../registry";

export class KBGA extends Registry {

    get name() {
        return 'Karl Barth Gesamtausgabe';
    }
    
    async query(key:string) {
        const results:RegistryResultItem[] = [];
        const register = this._register === 'people' || this._register === 'organisations' ? 'actors' : this._register;
        const url = `https://meta.karl-barth.ch/api/${register}?search=${encodeURIComponent(key)}`;
        console.log(url);
        const response = await axios.get(url);
        if (response.status !== 200) {
            return {
                totalItems: 0,
                items: []
            };
        }
        const json:any = response.data;
        let label: string;
        switch (this._register) {
            case 'places':
                label = 'placeName_full';
                break;
            case 'terms':
                label = 'fullLabel';
                break;
            case 'abbreviations':
                label = 'label';
                break;
            default:
                label = 'persName_full';
                break;
        }
        json.data.forEach((item:any) => {
            // KBGA returns both, people and organisations, so we need to filter out organisations
            // when searching for people
            if ((this._register === 'organisations' && item['authority_type'] !== 'organisation') ||
                (this._register === 'people' && item['authority_type'] !== 'person')) {
                    return;
            }
            const result:RegistryResultItem = {
                register: this._register,
                id: item['full-id'],
                label: item[label],
                details: item['full-id'],
                link: `https://meta.karl-barth.ch/${register}/${item.id}`
            };
            results.push(result);
        });
        return {
            totalItems: json.meta.total,
            items: results
        };
    }
}
