import { Certificate } from 'thor-devkit';

declare global {
  type Annex = Pick<Certificate, 'domain' | 'signer' | 'timestamp'>;

  type CertificateData = Pick<Certificate, 'signature'> & {
    annex: Annex;
  };
}
