import axios from 'axios';
import { Registry, RegistryResultItem } from "../registry";

export class Metagrid extends Registry {

    async query(key:string) {
        const results:RegistryResultItem[] = [];
        const url = `https://api.metagrid.ch/search/person?query=${encodeURIComponent(key)}`;
        console.log(url);
        const response = await axios.get(url);
        if (response.status !== 200) {
            return {
                totalItems: 0,
                items: []
            };
        }
        const json:any = response.data;
        json.concordances.forEach((item:any) => {
            const result:RegistryResultItem = {
                register: 'places',
                type: 'person',
                id: item.id,
                label: item.name,
                link: item.uri
            };
            results.push(result);
        });
        return {
            totalItems: json.concordances.length,
            items: results
        };
    }

    format(item: RegistryResultItem) {
        switch (this._register) {
            case 'people':
                return `<persName ref="metagrid-${item.id}">$TM_SELECTED_TEXT</persName>`;
            case 'organisations':
                return `<orgName ref="metagrid-${item.id}">$TM_SELECTED_TEXT</orgName>`;
            case 'places':
                return `<placeName ref="metagrid-${item.id}">$TM_SELECTED_TEXT</placeName>`;
            case 'terms':
                return `<term ref="metagrid-${item.id}">$TM_SELECTED_TEXT</term>`;
        }
    }
}