export interface ResolvedSoapOperation {
  soapAction: string;
  style: "document";
}

export interface ResolvedSoapService {
  serviceName: string;
  portName: string;
  endpointUrl: string;
  targetNamespace: string;
  soapVersion: "1.1";
  operations: Record<string, ResolvedSoapOperation>;
}
