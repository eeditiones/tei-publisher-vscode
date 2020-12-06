export abstract class Registry {
    _register:string;

    constructor(config:any) {
        this._register = config.name;
    }

    abstract query(key:string): Promise<RegistryResult[]>;
    abstract format(item: RegistryResult): string | undefined;
}

export interface RegistryResult {
    register: string,
    type: string,
    id: string,
    label: string,
    link?: {
        url: string,
        label: string
    }
};