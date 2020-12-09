import axios from 'axios';
import { Registry, RegistryResultItem } from "../registry";

export class Metagrid extends Registry {

    async query(key:string) {
        const query = key.replace(/[^\w\s]+/g, '');
        const results:RegistryResultItem[] = [];
        const url = `https://api.metagrid.ch/search?query=${encodeURIComponent(query)}`;
        console.log(url);
        const response = await axios.get(url);
        if (response.status !== 200 || !(response.data && response.data.resources)) {
            return {
                totalItems: 0,
                items: []
            };
        }
        const json:any = response.data;
        json.resources.forEach((item:any) => {
            const name = `${item.metadata.first_name} ${item.metadata.last_name}`;
            const result:RegistryResultItem = {
                register: 'people',
                type: 'person',
                id: item.concordance.id,
                label: name,
                details: `${item.metadata.birth_date} - ${item.metadata.death_date}`,
                link: item.link.uri
            };
            results.push(result);
        });
        return {
            totalItems: json.meta.total,
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