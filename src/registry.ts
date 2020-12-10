/**
 * Abstract base class to be implemented by all connectors.
 */
export abstract class Registry {
    _register:string;
    _config:any;

    constructor(config:any) {
        this._config = config;
        this._register = config.name;
    }

    /**
     * Query the authority and return a RegistryResult.
     * 
     * @param key the search string
     */
    abstract query(key:string): Promise<RegistryResult>;

    /**
     * Return an XML fragment for the specified item to be inserted
     * into the document.
     * 
     * @param item the item to output
     */
    format(item: RegistryResultItem): string | undefined {
        const template = this._config.template;
        return template.replace(/\${(\w+)}/, (match:string, p:string) => {
            let replacement;
            switch (p) {
                case 'label':
                    replacement = item.label;
                    break;
                case 'link':
                    replacement = item.link;
                    break;
                case 'details':
                    replacement = item.details;
                    break;
                case 'id':
                    replacement = item.id;
                    break;
            }
            return replacement || match;
        });
    }
}

/**
 * A single item retrieved from the authority
 */
export interface RegistryResultItem {
    /**
     * Id of the registry from which this item was retrieved.
     */
    register: string;
    /**
     * Unique ID of the item reported by the authority
     */
    id: string;
    /**
     * Main label to display
     */
    label: string;
    /**
     * Optional link URL
     */
    link?: string;
    /**
     * Optional details to display
     */
    details?: any;
};

export interface RegistryResult {
    /**
     * total number of items
     */
    totalItems: number;

    /**
     * the items received
     */
    items: RegistryResultItem[];
}