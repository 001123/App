import type {Country} from '@src/CONST';

type Address = {
    street: string;
    street2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: Country | '' | 'country';
    zipPostCode?: string;
    addressLine1?: string;
    addressLine2?: string;
    lat?: string;
    lng?: string;
    zipCode?: string;
    address?: string;
};

type PrivatePersonalDetails = {
    legalFirstName?: string;
    legalLastName?: string;
    dob?: string;
    phoneNumber?: string;

    /** User's home address */
    address?: Address;

    /** Whether we are loading the data via the API */
    isLoading?: boolean;
};

export default PrivatePersonalDetails;

export type {Address};
