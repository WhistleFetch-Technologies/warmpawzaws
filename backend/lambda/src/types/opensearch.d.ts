/**
 * Type declarations for OpenSearch SDK
 */

declare module '@opensearch-project/opensearch' {
  export class Client {
    constructor(options: any);
    indices: {
      create(params: any): Promise<any>;
      delete(params: any): Promise<any>;
      exists(params: any): Promise<any>;
      refresh(params: any): Promise<any>;
    };
    index(params: any): Promise<any>;
    update(params: any): Promise<any>;
    bulk(params: any): Promise<any>;
    search(params: any): Promise<any>;
    delete(params: any): Promise<any>;
    deleteByQuery(params: any): Promise<any>;
  }
}

declare module '@opensearch-project/opensearch/aws' {
  export function AwsSigv4Signer(options: {
    region: string;
    service: string;
    getCredentials: () => Promise<any>;
  }): any;
}

