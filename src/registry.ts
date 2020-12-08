/**
 * Abstract base class to be implemented by all connectors.
 */
export abstract class Registry {
    _register:string;

    constructor(config:any) {
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
    abstract format(item: RegistryResultItem): string | undefined;
}

/**
 * A single item retrieved from the authority
 */
export interface RegistryResultItem {
    /**
     * Id of the registry from which this item was retrieved.
     */
    register: string;
    type: string;
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
    details?: string;
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