import axios from 'axios';
import { Registry, RegistryResultItem } from "../registry";

export class GND extends Registry {

    async query(key:string) {
        const results:RegistryResultItem[] = [];
        const response = await axios.get(`https://lobid.org/gnd/search?q=${encodeURIComponent(key)}&filter=%2B%28type%3APerson%29&format=json&size=100`);
        if (response.status !== 200) {
            return {
                totalItems: 0,
                items: []
            };
        }
        const json:any = response.data;
        json.member.forEach((item:any) => {
            const result:RegistryResultItem = {
                type: item.type.join(','),
                register: this._register,
                id: item.gndIdentifier,
                label: item.preferredName,
                link: item.id,
                details: this._details(item)
            };
            results.push(result);
        });
        return {
            totalItems: json.totalItems,
            items: results
        };
    }

    format(item: RegistryResultItem) {
        return `<persName ref="gnd-${item.id}">$TM_SELECTED_TEXT</persName>`;
    }

    _details(item: any) {
        let professions = '';
        if (item.professionOrOccupation && item.professionOrOccupation.length > 0) {
            professions = item.professionOrOccupation.map((p: { label: string; }) => p.label).join(', ');
        }
        const dates = [];
        if (item.dateOfBirth && item.dateOfBirth.length > 0) {
            dates.push(item.dateOfBirth[0]);
        }
        if (item.dateOfDeath && item.dateOfDeath.length > 0) {
            dates.push(' - ');
            dates.push(item.dateOfDeath[0]);
        }
        if (dates.length > 0) {
            return `${dates.join('')}${professions ? `; ${professions}` : ''}`;
        }
        return professions;
    }
}