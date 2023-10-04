import {OnyxUpdate} from 'react-native-onyx';

type Response = {
    previousUpdateID?: number | string;
    lastUpdateID?: number | string;
    jsonCode?: number | string;
    onyxData?: OnyxUpdate[];
    requestID?: string;
    message?: string;
    auth?: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    shared_secret?: string;
};

export default Response;
