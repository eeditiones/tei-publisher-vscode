export abstract class Registry {
    _register:string;

    constructor(config:any) {
        this._register = config.name;
    }

    abstract query(key:string): Promise<RegistryResult>;
    abstract format(item: RegistryResultItem): string | undefined;
}

export interface RegistryResultItem {
    register: string;
    type: string;
    id: string;
    label: string;
    link?: string;
    details?: string;
};

export interface RegistryResult {
    totalItems: number;
    items: RegistryResultItem[];
}