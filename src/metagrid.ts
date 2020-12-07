import axios from 'axios';
import { Registry, RegistryResult } from "./registry";

export class Metagrid extends Registry {

    async query(key:string) {
        const results:RegistryResult[] = [];
        const response = await axios.get(`https://api.metagrid.ch/search/${this._register}?query=${encodeURIComponent(key)}`);
        if (response.status !== 200) {
            return results;
        }
        const json:any = response.data;
        json.concordances.forEach((item:any) => {
            const result:RegistryResult = {
                register: 'places',
                type: 'person',
                id: item.id,
                label: item.name,
                link: {
                    url: item.uri,
                    label: item.id
                }
            };
            results.push(result);
        });
        return results;
    }

    format(item: RegistryResult) {
        switch (item.type) {
            case 'person':
                return `<persName ref="metagrid-${item.id}">$TM_SELECTED_TEXT</persName>`;
            case 'organisation':
                return `<orgName ref="metagrid-${item.id}">$TM_SELECTED_TEXT</orgName>`;
            case 'places':
                return `<placeName ref="metagrid-${item.id}">$TM_SELECTED_TEXT</placeName>`;
            case 'terms':
                return `<term ref="metagrid-${item.id}">$TM_SELECTED_TEXT</term>`;
        }
    }
}