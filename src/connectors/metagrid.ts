import axios from 'axios';
import { Registry, RegistryResultItem } from "../registry";

export class Metagrid extends Registry {

    get name() {
        return 'Metagrid';
    }
    
    async query(key:string) {
        const query = key.replace(/[^\w\s]+/g, '');
        const results:RegistryResultItem[] = [];
        const url = `https://api.metagrid.ch/search?query=${encodeURIComponent(query)}&take=500&group=true`;
        console.log(url);
        const response = await axios.get(url);
        if (response.status !== 200 || !(response.data && response.data.concordances)) {
            return {
                totalItems: 0,
                items: []
            };
        }
        const providers:string[]|null = this._config.options?.providers;
        const json:any = response.data;
        json.concordances.forEach((concordance:any) => {
            let item;
            if (providers) {
                for (let prov = 0; prov < providers.length; prov++) {
                    item = concordance.resources.find((resource:any) => providers[prov] === resource.provider.slug);
                    if (item) {
                        break;
                    }
                }
            } else {
                item = concordance.resources[0];
            }
            if (item) {
                const name = `${item.metadata.first_name} ${item.metadata.last_name}`;
                const slug = item.provider.slug;
                const details = `
                    <p>${item.metadata.birth_date} - ${item.metadata.death_date}</p>
                    <p><a href="${item.provider.uri}">${slug}</a></p>
                `;
                const result:RegistryResultItem = {
                    register: this._register,
                    id: `${slug}:${item.identifier}`,
                    label: name,
                    details: details,
                    link: item.link.uri
                };
                results.push(result);
            }
        });
        return {
            totalItems: results.length,
            items: results
        };
    }
}